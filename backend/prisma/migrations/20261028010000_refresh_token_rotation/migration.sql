ALTER TABLE "RefreshToken"
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD COLUMN "parentTokenId" TEXT;

CREATE UNIQUE INDEX "RefreshToken_parentTokenId_key" ON "RefreshToken"("parentTokenId");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_parentTokenId_fkey"
  FOREIGN KEY ("parentTokenId") REFERENCES "RefreshToken"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
