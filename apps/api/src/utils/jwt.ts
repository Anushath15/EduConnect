// jsonwebtoken is a CommonJS package whose default export is the whole
// module object. @types/jsonwebtoken does not declare a default export, so
// the `import/default` ESLint rule rejects the canonical `import jwt from ...`
// pattern. We disable the rule on the import line only — the type usage
// downstream is fully typed.
/* eslint-disable import/default, @typescript-eslint/no-var-requires */
import jwt from "jsonwebtoken"
/* eslint-enable import/default, @typescript-eslint/no-var-requires */

import { env } from "../config/env.js"

const ACCESS_SECRET = env.JWT_ACCESS_SECRET
// jsonwebtoken's expiresIn accepts a ms-style string ("15m"), a number of
// seconds, or a StringValue. We trust env validation to produce a valid form.
const ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN as unknown as jwt.SignOptions["expiresIn"]

export interface JwtPayload {
  userId:   string
  schoolId: string
  role:     string
  iat?:     number
  exp?:     number
}

export function signAccessToken(payload: object): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN })
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload
  } catch {
    return null
  }
}
