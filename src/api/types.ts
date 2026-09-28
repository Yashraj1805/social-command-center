import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Raw request body string, captured before JSON parsing, needed to
     * verify Meta's X-Hub-Signature-256 header (HMAC is computed over the
     * exact bytes Meta sent, which a re-serialized JS object would not
     * reproduce). Set by the content-type parser in api/app.ts. */
    rawBody?: string;
  }
}
