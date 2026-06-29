const handler = async (req, res) => {
  const { default: serverEntry } = await import("../dist/server/server.js");

  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url || "/"}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body,
  });

  const response = await serverEntry.fetch(request);

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  res.writeHead(response.status, responseHeaders);

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
};

export default handler;

export const config = {
  api: {
    bodyParser: false,
  },
};
