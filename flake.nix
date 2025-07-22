{
  description = "Multifactor CLI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/25.05";
  };
  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = nixpkgs.legacyPackages;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor.${system};
        in
        {
          default = pkgs.buildNpmPackage {
            pname = "multifactor-cli";
            version = "1.0.3";
            src = ./.;

            npmDepsHash = "sha512-wwV4cnthtQNDlouubT09PDvjiCMOhnB40bOKWNClQrQvtcdbWzGHh1pBYTEjwKCryGcMfXmZ0U7qDFn8JfJsaw==";

            nativeBuildInputs = with pkgs; [
              nodejs_22
              nodePackages.typescript
              tree
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

              mkdir -p $out/bin
              cp -r dist package.json node_modules $out/

              echo '#!/usr/bin/env bash
                ${pkgs.nodejs_22}/bin/node '"$out/dist/cli.js"\
                > $out/bin/multifactor-cli
              chmod +x $out/bin/multifactor-cli

              runHook postInstall
            '';

            meta = {
              description = "CLI tool for bypassing multifactor authentication";
              homepage = "https://github.com/alexstrnik/multifactor-cli";
              license = pkgs.lib.licenses.isc;
              maintainers = with pkgs.lib.maintainers; [ ];
            };
          };
        }
      );

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/multifactor-cli";
        };
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor.${system};
        in
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_22
              nodePackages.typescript
              nodePackages.typescript-language-server
            ];

            shellHook = ''
              echo "Multifactor CLI development environment"
              echo "Run 'npm install' to set up dependencies"
              echo "Run 'npm run build' to build the project"
              echo "Run 'npm run start' to start the CLI"
            '';
          };
        }
      );
    };
}
