const { stitchSchemas } = require('@graphql-tools/stitch');
const { RenameRootFields } = require('@graphql-tools/wrap');
const { RenameRootTypes } = require('@graphql-tools/wrap');
const { loadGraphQLSchemaFromOpenAPI } = require('@omnigraph/openapi');
const { getMesh } = require('@graphql-mesh/runtime');
const { printSchemaWithDirectives } = require('@graphql-tools/utils');
const { wrappers } = require('./wrappers');
const { decorateBaseSchema } = require('./decorateBaseSchema');

const basicHeaders = {
  'Content-Type': 'application/json',
};

async function oasToGraphQlSchema(oas, baseUrl, token, operationIdFieldNames) {
  const aa = loadGraphQLSchemaFromOpenAPI('kubeApi', {
    source: {
      schema: oas,
      name: 'kubeApi',
      baseUrl,
      operationIdFieldNames,
      fetch: async (url, options) => {
        options.headers = {
          ...basicHeaders,
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        return fetch(url, options);
      },
    },
    cwd: process.cwd(),
  });
  return aa;
}

exports.createSchema = async (oas, kubeApiUrl, token) => {
  let baseSchema = (await oasToGraphQlSchema(oas, kubeApiUrl, token));
  console.log(baseSchema);
  wrappers.forEach(
    ({
      type, fieldWrapper, nameWrapper, queryFieldsRequired,
    }) => {
      baseSchema = decorateBaseSchema(
        type,
        fieldWrapper,
        baseSchema,
        nameWrapper,
        queryFieldsRequired,
      );
    },
  );

  return baseSchema;
};

exports.oasToGraphQlSchema = oasToGraphQlSchema;

/**
 * stitch schemas by merging them, possibly prefixing root fields
 * schemas is an object like { schema, prefix? }
 *
 * @param {GraphQLSchema[]} schemas
 * @returns
 */
module.exports.joinSchemas = (schemas) => {
  const subschemas = schemas.map(({ schema, prefix }) => ({
    schema,
    transforms: prefix ? [
      new RenameRootFields((operation, name, _field) => `${prefix}_${name}`),
      new RenameRootTypes((name) => `${prefix}_${name}`),
    ] : [],
  }));

  const schema = stitchSchemas({ subschemas });
  return schema;
};
