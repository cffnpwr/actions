# create-github-app

`create-github-app` registers a GitHub App with the manifest flow, waits until the App is installed on the repositories, and writes its Client ID and private key to the destination in the definition file.

[日本語のREADMEはこちら](./README-ja.md)

## How to Use

[`apps/`](./apps) has the definitions of the GitHub Apps that are installed on several repositories and used by the Terraform plan and apply in their CI.
[`app_example.yaml`](./app_example.yaml) shows an example of the definition file and describes each key.
Create a GitHub App as follows.

1. Download the definition file of the GitHub App.

   ```sh
   curl -fsSLO https://raw.githubusercontent.com/cffnpwr/actions/<SHA>/modules/github-app/apps/terraform-plan.yaml
   ```

2. Run `create-github-app` with the definition file and the repositories to install the App on.

   ```sh
   go run github.com/cffnpwr/actions/modules/github-app/cmd/create-github-app@<SHA> \
     --config terraform-plan.yaml \
     --repo cffnpwr/home-iac \
     --repo cffnpwr/dotfiles
   ```

3. Create the GitHub App in the browser that `create-github-app` opens, then install it on the repositories given by `--repo`.

After the installation, `create-github-app` writes the Client ID and the private key to the destination.
Finally, it prints the slug, the App ID, and the Client ID of the created GitHub App to the standard output.
