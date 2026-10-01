# How to deploy CrownLabs

The CrownLabs business logic is composed of multiple containerized components, which are necessary to implement the desired services.
Specifically, it encompasses multiple Kubernetes operators, implementing the server-side logic, as well as a web-based dashboard, which exposes the different functionalities to the end users.

To simplify the deployment and the configuration of the different components, CrownLabs leverages an [Helm](https://helm.sh/) chart.
This folder contains the parent Helm chart which depends upon the different sub-charts responsible for the installation of the single components (e.g. the dashboard and each operator), available in the respective folders.
In the following, it is presented a brief description of the different steps required to deploy CrownLabs on your own cluster.

## Pre-requirements

CrownLabs relies upon a Kubernetes Cluster for the orchestration of the different components. Additionally, it depends on multiple infrastructural components, as better detailed in the [infrastructure folder](../../infrastructure). In particular, [KubeVirt](../../infrastructure/virtualization/README.md) is required in order to spawn virtual machines on top of the Kubernetes cluster.

## Deploying the Custom Resource Definitions (CRDs)

Before deploying the different CrownLabs components, and in particular the operators, it is necessary to install the CRDs they depend on.

At the moment, this operation is not automated by the Helm chart, and can be performed with the following command (from the CrownLabs root directory):

```bash
kubectl apply -f operators/deploy/crds
```

## Deploying CrownLabs

Once the CRDs have been correctly installed, it is possible to deploy CrownLabs.

First, it is necessary to configure the different parameters (e.g. number of replicas, URLs, credentials, ...), depending on the specific set-up.
In particular, this operation can be completed creating a copy of the [default configuration](values.yaml), and customizing it with the suitable values.

### Image catalogs and public snapshots

The ImageList updater is disabled by default. Set `operator.configurations.features.imageList: true` to enable it with the configured 600-second refresh interval. The default `operator.configurations.imageList.registries` list contains the Harbor catalogs `harbor-standalone` and `harbor-containerdisks`, plus the `public-snapshots` source writing `public-local-snapshots`.

The public source is added in this chart's [values.yaml](values.yaml). The operator subchart retains the Harbor sources and supplies the ConfigMap template and public namespace default. Set `operator.configurations.snapshotPublicNamespace` to change the public catalog namespace (default: `public-local-snapshots`): public sources that omit `namespace` automatically inherit this value in the generated ConfigMap. The `imageListName` remains independent. An explicitly configured source namespace is preserved and must be kept aligned with the public access configuration. The updater publishes every eligible completed snapshot in its configured namespace into an ImageList readable by all authenticated users; private and workspace catalogs should continue to use namespaced InstanceSnapshots.

When overriding `registries`, supply the complete list of sources to retain, since Helm replaces the list. Control updates through `operator.configurations.features.imageList`; omitting the source configuration from an override file retains the chart's default list.

For an existing installation, apply the updated [ImageList CRD](../../operators/deploy/crds/crownlabs.polito.it_imagelists.yaml) before upgrading the operator, then restart qlkube so its GraphQL schema exposes the optional `versionDetails` volume capacity metadata. Frontend consumers must explicitly request and handle these fields.

See the [ImageList updater documentation](../../operators/README.md#crownlabs-image-list-updater) for source configuration, local image/version naming, GraphQL examples and catalog checks.

### Gateway API & Routing Configuration

CrownLabs uses **Envoy Gateway** implementing the Kubernetes Gateway API (`gateway.networking.k8s.io/v1`) for L7 traffic routing and authentication.

For detailed information regarding the Gateway Configuration Model, Control Flags, and Authentication mechanisms, please refer to the dedicated [Authentication and Centralized Gateway](docs/authentication-and-gateway.md) document.
---


Then, it is possible to proceed with the deployment/upgrade of CrownLabs (all commands are relative to the CrownLabs root directory):

```bash
# Get the version to be deployed (e.g. the latest commit on master)
git fetch origin master
VERSION=$(git show-ref -s origin/master)

# Update the sub-chart dependencies
helm dependency update deploy/crownlabs

# Package the Helm chart with the desired version
helm package deploy/crownlabs --app-version=${VERSION}

# Perform the CrownLabs installation/upgrade
helm upgrade crownlabs crownlabs-*.tgz \
  --install --create-namespace \
  --namespace crownlabs-production \
  --values path/to/configuration.yaml \
  --set global.version=${VERSION}
```
