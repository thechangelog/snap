import { URL } from "url";

import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import Fastify from "fastify";
import puppeteer from "puppeteer";

const S3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
});

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function imgOnS3(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });
    await S3.send(command);
    return true;
  } catch (err) {
    if (err.name === "NotFound") {
      return false;
    } else {
      throw err;
    }
  }
}

function s3Url(key) {
  const parts = [process.env.AWS_ENDPOINT_URL_S3, process.env.BUCKET_NAME, key];
  return parts.join("/");
}

async function uploadImg(key, data) {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: "image/jpeg",
    });

    await S3.send(command);
  } catch (err) {
    console.error("Error uploading image", err);
    throw err;
  }
}

const readUrl = async (url) => {
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: "networkidle2" });

  if (response.status() == 200) {
    await page.setViewport({ width: 1200, height: 630 });

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

fastify.get("/", async function (_request, reply) {
  reply.redirect("https://changelog.com");
});

fastify.get("*", async function (request, reply) {
  try {
    const path = request.url;
    const file = path.replace("/", "").replace(/\//g, "-");

    if (await imgOnS3(file)) {
      console.log("it's on S3!");
      return reply.redirect(302, s3Url(file));
    } else {
      const img = await readUrl(`https://changelog.com${path}`);
      await uploadImg(file, img);
      return reply.type("image/jpg").send(img);
    }
  } catch (error) {
    fastify.log.error(error);
    return reply
      .code(404)
      .send({ message: "Not Found", error: "Not Found", statusCode: 404 });
  }
});

try {
  await fastify.listen({ host: "0.0.0.0", port: 3000 });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
