import Fastify from "fastify";
import puppeteer from "puppeteer";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const HOST = "https://changelog.com";
const FASTIFY = Fastify({ logger: true });
const S3 = new S3Client();
const CHROME = await puppeteer.launch({
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function getSnap(url) {
  const page = await CHROME.newPage();
  const response = await page.goto(url, { waitUntil: "networkidle2" });

  if (response.status() == 200) {
    await page.setViewport({ width: 1200, height: 630 });

    const snap = await page.screenshot({ fullPage: false });
    await page.close();
    return snap;
  } else {
    throw new Error(`!200 OK: ${response.status()}`);
  }
}

async function storeSnap(key, data) {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: "image/jpeg",
    });

    await S3.send(command);
  } catch (error) {
    console.error("Error uploading image", error);
    throw error;
  }
}

async function isSnapStored(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });
    await S3.send(command);
    return true;
  } catch (error) {
    if (error.name === "NotFound") {
      return false;
    } else {
      throw error;
    }
  }
}

FASTIFY.get("/", async function (_request, reply) {
  reply.redirect(HOST);
});

FASTIFY.get("*", async function (request, reply) {
  try {
    const path = request.url;
    const file = path.replace("/", "").replace(/\//g, "-");

    if (await isSnapStored(file)) {
      const url = [
        process.env.AWS_ENDPOINT_URL_S3,
        process.env.BUCKET_NAME,
        file,
      ].join("/");

      return reply.redirect(302, url);
    } else {
      const snap = await getSnap(`${HOST}${path}`);
      await storeSnap(file, snap);

      return reply.type("image/jpg").send(snap);
    }
  } catch (error) {
    FASTIFY.log.error(error);

    return reply.code(404).send({ message: "Not Found", statusCode: 404 });
  }
});

try {
  await FASTIFY.listen({ host: "0.0.0.0", port: 3000 });
} catch (error) {
  FASTIFY.log.error(error);
  process.exit(1);
}
