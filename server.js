import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { URL } from "url";

import Fastify from "fastify";
import puppeteer from "puppeteer";

const host = "https://changelog.com";
const tmpdir = path.join(os.tmpdir(), "share");
const cacheFor = 60 * 10000;
const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

const getImg = async (path) => {
  const url = new URL(`${host}${path}`);
  const file = url.pathname.split("/").join("-");

  const tmpImg = await readTmpImg(file);

  if (tmpImg) {
    return tmpImg;
  } else {
    const img = await readUrl(url);
    await writeTmpImg(file, img);
    return img;
  }
};

const readTmpImg = async (name) => {
  const tmpImgPath = path.join(tmpdir, `${name}.jpg`);

  try {
    return await fs.readFile(tmpImgPath);
  } catch (error) {
    return null;
  }
};

const writeTmpImg = async (name, img) => {
  const tmpImgPath = path.join(tmpdir, `${name}.jpg`);
  await fs.writeFile(tmpImgPath, img);

  setTimeout(async () => {
    try {
      await fs.rm(tmpImgPath, { force: true });
      fastify.log.info(`Temporary file removed: ${tmpImgPath}`);
    } catch (error) {
      console.error(`Error removing temporary file: ${error.message}`);
    }
  }, cacheFor);

  return tmpImgPath;
};

const readUrl = async (url) => {
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: "networkidle2" });

  if (response.status() == 200) {
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

    const img = await page.screenshot({ fullPage: false });
    await page.close();
    return img;
  } else {
    throw new Error("!200 OK");
  }
};

const fastify = Fastify({
  logger: true,
});

fastify.get("*", async function (request, reply) {
  try {
    const img = await getImg(request.url);
    return reply.type("image/jpg").send(img);
  } catch (error) {
    fastify.log.error(error);
    return reply
      .code(404)
      .send({ message: "Not Found", error: "Not Found", statusCode: 404 });
  }
});

try {
  await fs.rm(tmpdir, { recursive: true, force: true });
  await fs.mkdir(tmpdir);
  await fastify.listen({ host: "0.0.0.0", port: 3000 });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
