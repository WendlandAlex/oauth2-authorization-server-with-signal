# Multi-stage Dockerfile with thick build layer and thin final layer
FROM node:22-slim as build-stage
WORKDIR build/
COPY --link package.json package-lock.json tsconfig.json ./
RUN npm ci

# Expect that this will run the typechecker, but don't generate any new code
COPY --link src/ src/
COPY --link types/ types/
RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR app/
COPY --from=build-stage /build/ ./

# Use type stripping to execute the (typechecked) ts files
CMD ["--experimental-strip-types", "src/index.ts"]
