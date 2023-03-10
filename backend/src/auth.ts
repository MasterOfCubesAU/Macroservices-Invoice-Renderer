import { createHash } from "crypto";
import { InvalidKeyError, UnauthorisedError } from "./error";
import { NextFunction, Request, Response } from "express";

/**
 * Given an API key, determine if the client has access
 * @param apiKey the API key to use with the API
 *
 * @throws {UnauthorisedError} - if there is no API key provided
 * @throws {InvalidKeyError} - if the provided API key is invalid
 */
export async function validateSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["api-key"] as string;
  if (apiKey === undefined) {
    throw new UnauthorisedError();
  } else if (
    createHash("sha256").update(apiKey).digest("hex") !== process.env.API_KEY
  ) {
    throw new InvalidKeyError();
  }
  next();
}
