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
      nixpkgsFor = forAllSystems (system: import nixpkgs { inherit system; });
    in
    {
      # Package definitions
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgsFor.${system};
        in
        rec {
          default = multifactor-cli;
          multifactor-cli = pkgs.callPackage ./. {
            inherit pkgs;
            nodejs = pkgs.nodejs_22;
          };
        }
      );

      # App definitions
      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/multifactor-cli";
        };
      });

      # Development shell
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgsFor.${system};
        in
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_22
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
