import fs from "fs";
import http from "http";

/** @type {number|string} */
let dataForSSE;

http
	.createServer((req, res) => {
		const reqUrl = new URL(req.url, `http://${req.headers.host}`);

		if (reqUrl.pathname === "/send-message") {
			const message = reqUrl.searchParams.get("message");
			dataForSSE = message;
			res.end();
			return;
		}

		if (req.url === "/get-stream") {
			sse(req, res);
			console.log("sse started");
			return;
		}

		fs.createReadStream("index.html").pipe(res);
	})
	.listen(8080, () => {
		console.log("Server running at http://127.0.0.1:8080");
	});

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function sse(_req, res) {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("Access-Control-Allow-Origin", "*");

	let id = 0;

	const intervalId = setInterval(() => {
		const message = dataForSSE ?? `Some random data: ${getRandomInt(100)}`;
		res.write(`data: ${message}\n`);
		res.write(`id: ${++id}\n\n`);
	}, 1000);

	setTimeout(() => {
		clearInterval(intervalId);
		res.write("event: sse-stopped\n");
		res.write("data: sse stopped\n");
		res.write(`id: ${++id}\n\n`);
		console.log("sse stopped");
		res.end("Ok");
	}, 60_000);
}

/**
 * @param {number} max
 */
function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}
