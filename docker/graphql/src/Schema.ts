import { makeExecutableSchema } from 'graphql-tools';
import { logger } from '@docker-stack/graphql/Logger';
import { toGlobalId } from 'graphql-relay';
import { Context } from '@docker-stack/graphql/Context';
import { sql } from '@docker-stack/graphql/Postgres';

const graphql = String.raw;

const schemaSDL = graphql`

input SearchCompaniesQuery {
    textQuery: String
}

type Viewer {
    id: ID!
    searchCompanies(input: SearchCompaniesQuery): CompanyConnection!
}

type CompanyConnection {
    total: Int!
    edges: [CompanyEdge!]!
}

type CompanyEdge {
    node: Company
}

type Query {
    viewer: Viewer!
}

type Company {
    id: ID!
    name: String!
}

input CreateCompanyInput {
    name: String!
}

type CreateCompanyPayload {
    company: Company!
}

type Mutation {
    createCompany(input: CreateCompanyInput!): CreateCompanyPayload!
}
# type Subscription

schema {
    query: Query
    mutation: Mutation
    # subscription: Subscription
}
`;

export const schema = makeExecutableSchema({
    resolvers: {
        Mutation: {
            createCompany: (_context, args, _req, _info) => ({
                company: {
                    id: toGlobalId('Company', '1'),
                    name: args.input.name,
                },
            }),
        },
        Query: {
            viewer: () => ({ id: toGlobalId('Viewer', '1') }),
        },
        Viewer: {
            searchCompanies: async (_viewer, _args, context: Context) => {
                const result = await context.PostgresClient.query(sql`
                    SELECT
                        cc.id,
                        cc.name
                    FROM
                        crm.companies cc
                `)
                return {
                    total: result.rowCount,
                    edges: result.rows.map(row => ({
                        node: row,
                    })),
                };
            },
        },
    },
    logger: logger,
    typeDefs: schemaSDL,
});
