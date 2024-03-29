import type { NextApiRequest, NextApiResponse } from "next";
import { DBRun, DBGet } from "@src/utils/DBHandler";
import { createHash } from "crypto";
import * as EmailValidator from "email-validator";
import { Session } from "@src/interfaces";
import { PASSWORD_MIN_LENGTH } from "@src/constants";

/**
 * This function attempts to register a user, creating a session.
 * This function will return:
 * 200 - When registration is successful
 * 405 - If any request is not a POST request
 * 400 - If any of the fields are empty
 * 400 - If the email is not a valid email
 * 400 - If the password is less than 6 characters long
 * 409 - If the email already exists
 * @param {NextApiRequest} - The Next API request
 * @param {NextApiResponse} - The Next API response
 * @returns {void}
 */
export default async function register_handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Only POST requests allowed" });
  const body = req.body;
  if (!body.identifier || !body.password || !body.name) {
    res.status(400).json({ error: "Fields cannot be empty." });
    return;
  }
  if (!EmailValidator.validate(body.identifier)) {
    res.status(400).json({ error: "Email is not a valid form." });
    return;
  }
  if (body.password < PASSWORD_MIN_LENGTH) {
    res
      .status(400)
      .json({ error: "Password must be at least 6 characters long." });
    return;
  }
  const hashedPassword = createHash("sha256")
    .update(body.password)
    .digest("hex");
  const user = await DBGet(
    "SELECT Identifier FROM Users WHERE Identifier = ?",
    [body.identifier]
  );
  if (user) {
    res.status(409).json({ error: "User already exists." });
  } else {
    await DBRun(
      "INSERT INTO Users (Identifier, Password, Name) VALUES (?,?,?)",
      [body.identifier, hashedPassword, body.name]
    );
    const session: Session = {
      email: body.identifier as string,
      name: body.name as string,
    };
    res.status(200).json({ user: session });
  }
}
