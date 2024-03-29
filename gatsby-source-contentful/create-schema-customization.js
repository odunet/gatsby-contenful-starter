"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.createSchemaCustomization = createSchemaCustomization;

var _camelCase2 = _interopRequireDefault(require("lodash/camelCase"));

var _upperFirst2 = _interopRequireDefault(require("lodash/upperFirst"));

var _fetch = require("./fetch");

var _pluginOptions = require("./plugin-options");

var _report = require("./report");

var _gatsbyPluginImage = require("./gatsby-plugin-image");

var _schemes = require("./schemes");

var _commonTags = require("common-tags");

var _polyfillRemoteFile = require("gatsby-plugin-utils/polyfill-remote-file");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

async function getContentTypesFromContentful({
  cache,
  reporter,
  pluginConfig
}) {
  // Get content type items from Contentful
  const allContentTypeItems = await (0, _fetch.fetchContentTypes)({
    pluginConfig,
    reporter
  });
  const contentTypeFilter = pluginConfig.get(`contentTypeFilter`);
  const contentTypeItems = allContentTypeItems.filter(contentTypeFilter);

  if (contentTypeItems.length === 0) {
    reporter.panic({
      id: _report.CODES.ContentTypesMissing,
      context: {
        sourceMessage: `Please check if your contentTypeFilter is configured properly. Content types were filtered down to none.`
      }
    });
  } // Check for restricted content type names and set id based on useNameForId


  const useNameForId = pluginConfig.get(`useNameForId`);
  const restrictedContentTypes = [`entity`, `reference`, `asset`];

  if (pluginConfig.get(`enableTags`)) {
    restrictedContentTypes.push(`tag`);
  }

  contentTypeItems.forEach(contentTypeItem => {
    // Establish identifier for content type
    //  Use `name` if specified, otherwise, use internal id (usually a natural-language constant,
    //  but sometimes a base62 uuid generated by Contentful, hence the option)
    let contentTypeItemId = contentTypeItem.sys.id;

    if (useNameForId) {
      contentTypeItemId = contentTypeItem.name.toLowerCase();
    }

    if (restrictedContentTypes.includes(contentTypeItemId)) {
      reporter.panic({
        id: _report.CODES.FetchContentTypes,
        context: {
          sourceMessage: `Restricted ContentType name found. The name "${contentTypeItemId}" is not allowed.`
        }
      });
    }
  }); // Store processed content types in cache for sourceNodes

  const sourceId = `${pluginConfig.get(`spaceId`)}-${pluginConfig.get(`environment`)}`;
  const CACHE_CONTENT_TYPES = `contentful-content-types-${sourceId}`;
  await cache.set(CACHE_CONTENT_TYPES, contentTypeItems);
  return contentTypeItems;
}

async function createSchemaCustomization({
  schema,
  actions,
  store,
  reporter,
  cache
}, pluginOptions) {
  console.log('*************************')
  console.log('Customization start')
  console.log('*************************')
  const {
    createTypes
  } = actions;
  const pluginConfig = (0, _pluginOptions.createPluginConfig)(pluginOptions);
  let contentTypeItems;

  if (process.env.GATSBY_WORKER_ID) {
    console.log('*************************')
    console.log(`Inside worker, the worker Id is: ${process.env.GATSBY_WORKER_ID}`)
    console.log('*************************')
    const sourceId = `${pluginConfig.get(`spaceId`)}-${pluginConfig.get(`environment`)}`;
    contentTypeItems = await cache.get(`contentful-content-types-${sourceId}`);
  } else {
    console.log('*************************')
    console.log(`Outside worker, the worker Id is: ${process.env.GATSBY_WORKER_ID}`)
    console.log('*************************')
    contentTypeItems = await getContentTypesFromContentful({
      cache,
      reporter,
      pluginConfig
    });
    console.log('$$$$$$$$$$$$$$$$$$$$$$$$-Outside worker data');
    console.log(process.env);
    console.log('$$$$$$$$$$$$$$$$$$$$$$$$-Outside worker data');
  }

  const {
    getGatsbyImageFieldConfig
  } = await Promise.resolve().then(() => _interopRequireWildcard(require(`gatsby-plugin-image/graphql-utils`)));
  const contentfulTypes = [schema.buildInterfaceType({
    name: `ContentfulEntry`,
    fields: {
      contentful_id: {
        type: `String!`
      },
      id: {
        type: `ID!`
      },
      node_locale: {
        type: `String!`
      }
    },
    extensions: {
      infer: false
    },
    interfaces: [`Node`]
  }), schema.buildInterfaceType({
    name: `ContentfulReference`,
    fields: {
      contentful_id: {
        type: `String!`
      },
      id: {
        type: `ID!`
      }
    },
    extensions: {
      infer: false
    }
  })];
  contentfulTypes.push((0, _polyfillRemoteFile.addRemoteFilePolyfillInterface)(schema.buildObjectType({
    name: `ContentfulAsset`,
    fields: {
      contentful_id: {
        type: `String!`
      },
      id: {
        type: `ID!`
      },
      gatsbyImageData: getGatsbyImageFieldConfig(async (...args) => (0, _gatsbyPluginImage.resolveGatsbyImageData)(...args, {
        cache
      }), {
        jpegProgressive: {
          type: `Boolean`,
          defaultValue: true
        },
        resizingBehavior: {
          type: _schemes.ImageResizingBehavior
        },
        cropFocus: {
          type: _schemes.ImageCropFocusType
        },
        cornerRadius: {
          type: `Int`,
          defaultValue: 0,
          description: (0, _commonTags.stripIndent)`
                 Desired corner radius in pixels. Results in an image with rounded corners.
                 Pass \`-1\` for a full circle/ellipse.`
        },
        quality: {
          type: `Int`,
          defaultValue: 50
        }
      }),
      ...(pluginConfig.get(`downloadLocal`) ? {
        localFile: {
          type: `File`,
          extensions: {
            link: {
              from: `fields.localFile`
            }
          }
        }
      } : {})
    },
    interfaces: [`ContentfulReference`, `Node`, `RemoteFile`]
  }), {
    schema,
    actions,
    store
  })); // Create types for each content type

  contentTypeItems.forEach(contentTypeItem => contentfulTypes.push(schema.buildObjectType({
    name: (0, _upperFirst2.default)((0, _camelCase2.default)(`Contentful ${pluginConfig.get(`useNameForId`) ? contentTypeItem.name : contentTypeItem.sys.id}`)),
    fields: {
      contentful_id: {
        type: `String!`
      },
      id: {
        type: `ID!`
      },
      node_locale: {
        type: `String!`
      }
    },
    interfaces: [`ContentfulReference`, `ContentfulEntry`, `Node`]
  })));

  if (pluginConfig.get(`enableTags`)) {
    contentfulTypes.push(schema.buildObjectType({
      name: `ContentfulTag`,
      fields: {
        name: {
          type: `String!`
        },
        contentful_id: {
          type: `String!`
        },
        id: {
          type: `ID!`
        }
      },
      interfaces: [`Node`],
      extensions: {
        infer: false
      }
    }));
  }

  createTypes(contentfulTypes);
  console.log('*************************')
  console.log('Customization end')
  console.log('*************************')
}