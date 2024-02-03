const fs = require("fs");
const http2 = require("http2");
const EventEmitter = require("events").EventEmitter;
const {
	HTTP2_HEADER_SCHEME,
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_AUTHORITY,
	HTTP_STATUS_OK,
} = require("http2").constants;

/** @type {string} cookie */
const parseCookie = (cookie) => {
	return cookie.split(";").reduce((acc, item) => {
		const [key, value] = item.split("=");
		acc[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());

		return acc;
	}, {});
};

class EE extends EventEmitter {
	/**
	 * @param {http2.ServerHttp2Stream} stream
	 * @param {http2.IncomingHttpHeaders} headers
	 */
	init(stream, headers) {
		let id = 0;
		const cookie = headers.cookie ? parseCookie(headers.cookie) : {};
		console.debug("cookie: ", cookie);

		this.setMaxListeners(this.getMaxListeners() + 1);

		stream.respond({
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			"access-control-allow-origin": "*",
		});

		/**
		 * @param {string} message
		 */
		const dataListener = (message) => {
			if (message.event) {
				stream.write(`event: ${message.event}\n`);
			}

			stream.write(
				`data: ${message.data} of user ${cookie?.userName ?? "anonymous"}\n`,
			);
			stream.write(`id: ${++id}\n`);
			stream.write("\n");
		};

		this.on("data", dataListener);
		stream.on("close", () => {
			this.off("data", dataListener);
			console.debug("stream stopped");
			this.setMaxListeners(this.getMaxListeners() - 1);
		});
	}

	send(message) {
		this.emit("data", message);
	}
}

const sse = new EE();
const server = http2.createSecureServer({
	key: fs.readFileSync("localhost-privkey.pem"),
	cert: fs.readFileSync("localhost-cert.pem"),
});
server.on("error", (err) => console.error(err));

server
	.on("stream", (stream, headers) => {
		const scheme = headers[HTTP2_HEADER_SCHEME];
		const authority = headers[HTTP2_HEADER_AUTHORITY];
		const urlPath = headers[HTTP2_HEADER_PATH];
		const reqUrl = new URL(urlPath, `${scheme}://${authority}`);

		if (reqUrl.pathname === "/get-stream") {
			sse.init(stream, headers);
			console.debug("sse started");
			return;
		}

		if (reqUrl.pathname === "/login") {
			const userName = reqUrl.searchParams.get("userName");
			console.debug("userName: ", userName);
			stream.respond({
				"set-cookie": `userName=${userName}`,
				":status": "303",
				location: "/",
			});
		}

		if (reqUrl.pathname === "/send-message") {
			const message = reqUrl.searchParams.get("message");
			console.debug("message: ", message);
			sse.send({ data: message });
			stream.respond({ ":status": HTTP_STATUS_OK });
			stream.end("ok");
			return;
		}

		fs.createReadStream("index.html").pipe(stream);
	})
	.listen(8080, () => {
		console.debug("Server running at https://127.0.0.1:8080");
	});
