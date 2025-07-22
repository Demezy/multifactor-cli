{
  pkgs,
  lib ? pkgs.lib,
  nodejs ? pkgs.nodejs_22,
}:

pkgs.buildNpmPackage {
  pname = "multifactor-cli";
  version = "1.0.3";
  src = ./.;

  # npmDepsHash = lib.fakeHash;
  npmDepsHash = "sha256-/nlqvsXZYxyL/otbX6mmhYpVrAbWE5wjGXeQFKmX/Os=";

  nativeBuildInputs = [
    nodejs
    pkgs.makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    export HOME=$(mktemp -d)
    npm ci --no-audit --no-fund
    npm run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin $out/lib/node_modules/@alexstrnik/multifactor-cli

    # Copy package files to node_modules structure
    cp -r dist package.json node_modules $out/lib/node_modules/@alexstrnik/multifactor-cli/

    # Create the executable wrapper
    makeWrapper ${nodejs}/bin/node $out/bin/multifactor-cli \
      --add-flags $out/lib/node_modules/@alexstrnik/multifactor-cli/dist/cli.js
      
    runHook postInstall
  '';

  meta = with lib; {
    description = "CLI tool for bypassing multifactor authentication";
    homepage = "https://github.com/alexstrnik/multifactor-cli";
    license = licenses.isc;
    mainProgram = "multifactor-cli";
    platforms = platforms.all;
  };
}
