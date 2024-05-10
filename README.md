# Changelog Snap

This is a tiny Node.js PaaS (Puppeteer as a Service) that takes snaps of Changelog's dynamic episode image pages ([example](https://changelog.com/podcast/550/img)) and serves them for sharing.

The first time a snap is requested, it uploads the image to object storage for faster subsequent requests.

## Usage

1. Install dependencies via `npm install`
2. Set the following environment variables:

- AWS_ACCESS_KEY_ID
- AWS_ENDPOINT_URL_S3
- AWS_REGION
- AWS_SECRET_ACCESS_KEY
- BUCKET_NAME

3. Launch the server via `node server.js` or `npm start`

## Licence

[MIT](LICENSE)
