import { isStrongPassword } from "class-validator";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as ts from "typescript";
import { PASSWORD_POLICY } from "../../auth/dto/account-security.dto";
import {
  createOversizedTestPassword,
  createTestPassword,
  createTestSecret,
  createWeakTestPassword,
} from "./test-credentials.fixture";

describe("Ephemeral test credentials", () => {
  it("generates unique policy-compliant values without a reusable fixed credential", () => {
    const values = Array.from({ length: 100 }, createTestPassword);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(isStrongPassword(value, PASSWORD_POLICY)).toBe(true);
      expect(Buffer.byteLength(value, "utf8")).toBeLessThanOrEqual(72);
    }
    expect(createTestSecret()).not.toBe(createTestSecret());
    expect(isStrongPassword(createWeakTestPassword(), PASSWORD_POLICY)).toBe(
      false,
    );
    const oversized = createOversizedTestPassword();
    expect(isStrongPassword(oversized, PASSWORD_POLICY)).toBe(true);
    expect(oversized.length).toBeLessThanOrEqual(72);
    expect(Buffer.byteLength(oversized, "utf8")).toBeGreaterThan(72);
  });

  it.each([
    "modules/users/account-profile.spec.ts",
    "modules/users/account-security-postgres.spec.ts",
    "auth/registration-security.spec.ts",
    "auth/session-security.spec.ts",
    "files/storage.spec.ts",
    "modules/hotels/hotel-publication.spec.ts",
    "modules/saved-alerts/favorites-alerts-api.spec.ts",
  ])(
    "keeps credential assignments in %s free from fixed literal fragments",
    (file) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(resolve(__dirname, "../..", file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const violations: number[] = [];
      const visit = (node: ts.Node) => {
        if (
          (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
          /^(?:password\w*|currentPassword|newPassword|JWT_SECRET|REFRESH_TOKEN_SECRET|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|secret|secretHash)$/i.test(
            node.name.getText(source),
          ) &&
          node.initializer
        ) {
          const expression = node.initializer;
          const containsLiteral = (part: ts.Node): boolean =>
            (ts.isStringLiteral(part) && part.text.length > 0) ||
            (ts.isBinaryExpression(part) &&
              (containsLiteral(part.left) || containsLiteral(part.right)));
          if (containsLiteral(expression))
            violations.push(
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
                1,
            );
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(violations).toEqual([]);
    },
  );
});
