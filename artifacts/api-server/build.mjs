import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [
      path.resolve(artifactDir, "src/index.ts"),
      path.resolve(artifactDir, "src/lambda.ts")
    ],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      // firebase-admin is pre-installed in the dist folder during predeploy
      // (npm install --prefix artifacts/api-server/dist firebase-admin)
      // so we externalize it to avoid bundling its large dependency tree.
      "firebase-admin",
      "firebase-admin/*",
      "@google-cloud/firestore",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

async function writeFirebaseFiles() {
  const { writeFile, readFile, rm } = await import("node:fs/promises");
  const srcPkg = JSON.parse(
    await readFile(path.resolve(artifactDir, "package.json"), "utf8")
  );

  // @libsql/client is externalized by esbuild (native binary can't be bundled).
  // Its native binary (@libsql/linux-x64-gnu) is installed by the predeploy
  // `npm install --prefix artifacts/api-server/dist` step and Firebase uploads
  // the resulting node_modules alongside the function source.
  //
  // We intentionally write empty `dependencies: {}` here so that Cloud Build's
  // own `npm install` run is a no-op (nothing to install = no crash). The
  // pre-installed node_modules that were uploaded with the source are used
  // directly instead. Cloud Build's npm install was previously crashing with
  // "Exit handler never called!" because @libsql/client's postinstall script
  // tries to download a native binary inside Cloud Build's restricted network
  // environment.
  const distPkg = {
    name: srcPkg.name,
    version: srcPkg.version,
    private: true,
    main: "lambda.mjs",
    dependencies: {},
  };

  const distDir = path.resolve(artifactDir, "dist");

  await writeFile(
    path.join(distDir, "package.json"),
    JSON.stringify(distPkg, null, 2) + "\n"
  );

  // functions.yaml — Firebase CLI reads this file first (detectFromYaml).
  // When present it skips spawning the firebase-functions admin binary for
  // local analysis, so firebase-functions does NOT need to be installed in
  // dist/node_modules at all. Format: specVersion v1alpha1, matching the
  // onRequest config in lambda.ts exactly.
  await writeFile(
    path.join(distDir, "functions.yaml"),
    `specVersion: v1alpha1
endpoints:
  api:
    platform: gcfv2
    region:
      - asia-south1
    entryPoint: api
    timeoutSeconds: 300
    availableMemoryMb: 1024
    httpsTrigger: {}
`
  );

  // Remove node_modules from dist if they exist (left by a local npm install
  // during predeploy). Firebase ignores them during upload anyway, but a
  // stale node_modules can confuse the local Firebase CLI analysis step.
  await rm(path.join(distDir, "node_modules"), { recursive: true, force: true });
}

buildAll()
  .then(() => writeFirebaseFiles())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
