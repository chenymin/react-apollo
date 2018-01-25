import * as React from 'react';
import ApolloClient from 'apollo-client';
import { ApolloLink, Observable } from 'apollo-link';
import {
  execute,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLID,
} from 'graphql';
import {
  graphql,
  ApolloProvider,
  renderToStringWithData,
  Query,
} from '../../src';
import gql from 'graphql-tag';
import { InMemoryCache as Cache } from 'apollo-cache-inmemory';

const planetMap = new Map([['Planet:1', { id: 'Planet:1', name: 'Tatooine' }]]);

const shipMap = new Map([
  [
    'Ship:2',
    {
      id: 'Ship:2',
      name: 'CR90 corvette',
      films: ['Film:4', 'Film:6', 'Film:3'],
    },
  ],
  [
    'Ship:3',
    {
      id: 'Ship:3',
      name: 'Star Destroyer',
      films: ['Film:4', 'Film:5', 'Film:6'],
    },
  ],
]);

const filmMap = new Map([
  ['Film:3', { id: 'Film:3', title: 'Revenge of the Sith' }],
  ['Film:4', { id: 'Film:4', title: 'A New Hope' }],
  ['Film:5', { id: 'Film:5', title: 'the Empire Strikes Back' }],
  ['Film:6', { id: 'Film:6', title: 'Return of the Jedi' }],
]);

const PlanetType = new GraphQLObjectType({
  name: 'Planet',
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
});

const FilmType = new GraphQLObjectType({
  name: 'Film',
  fields: {
    id: { type: GraphQLID },
    title: { type: GraphQLString },
  },
});

const ShipType = new GraphQLObjectType({
  name: 'Ship',
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    films: {
      type: new GraphQLList(FilmType),
      resolve: ({ films }) => films.map(id => filmMap.get(id)),
    },
  },
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    allPlanets: {
      type: new GraphQLList(PlanetType),
      resolve: () => Array.from(planetMap.values()),
    },
    allShips: {
      type: new GraphQLList(ShipType),
      resolve: () => Array.from(shipMap.values()),
    },
    ship: {
      type: ShipType,
      args: { id: { type: GraphQLID } },
      resolve: (_, { id }) => shipMap.get(id),
    },
    film: {
      type: FilmType,
      args: { id: { type: GraphQLID } },
      resolve: (_, { id }) => filmMap.get(id),
    },
  },
});

const Schema = new GraphQLSchema({ query: QueryType });

const apolloClient = new ApolloClient({
  link: new ApolloLink(config => {
    return new Observable(observer => {
      execute(
        Schema,
        config.query,
        null,
        null,
        config.variables,
        config.operationName
      )
        .then(result => {
          observer.next(result);
          observer.complete();
        })
        .catch(e => {
          observer.error(e);
        });
    });
  }),
  cache: new Cache(),
});
describe('SSR', () => {
  describe('`renderToStringWithData`', () => {
    it('should work on a non trivial example (graphql hoc)', function() {
      @graphql(gql`
        query data($id: ID!) {
          film(id: $id) {
            title
          }
        }
      `)
      class Film extends React.Component<any, any> {
        render() {
          const { data } = this.props;
          if (data.loading) return null;
          const { film } = data;
          return <h6>{film.title}</h6>;
        }
      }

      @graphql(gql`
        query data($id: ID!) {
          ship(id: $id) {
            name
            films {
              id
            }
          }
        }
      `)
      class Starship extends React.Component<any, any> {
        render() {
          const { data } = this.props;
          if (data.loading) return null;
          const { ship } = data;
          return (
            <div>
              <h4>{ship.name} appeared in the following flims:</h4>
              <br />
              <ul>
                {ship.films.map((film, key) => (
                  <li key={key}>
                    <Film id={film.id} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      }

      @graphql(
        gql`
          query data {
            allShips {
              id
            }
          }
        `
      )
      class AllShips extends React.Component<any, any> {
        render() {
          const { data } = this.props;
          return (
            <ul>
              {!data.loading &&
                data.allShips.map((ship, key) => (
                  <li key={key}>
                    <Starship id={ship.id} />
                  </li>
                ))}
            </ul>
          );
        }
      }

      @graphql(
        gql`
          query data {
            allPlanets {
              name
            }
          }
        `
      )
      class AllPlanets extends React.Component<any, any> {
        render() {
          const { data } = this.props;
          if (data.loading) return null;
          return (
            <div>
              <h1>Planets</h1>
              {data.allPlanets.map((planet, key) => (
                <div key={key}>{planet.name}</div>
              ))}
            </div>
          );
        }
      }

      const Bar = () => (
        <div>
          <h2>Bar</h2>
          <AllPlanets />
        </div>
      );
      const Foo = () => (
        <div>
          <h1>Foo</h1>
          <Bar />
        </div>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <div>
            <Foo />
            <hr />
            <AllShips />
          </div>
        </ApolloProvider>
      );

      return renderToStringWithData(app).then(markup => {
        expect(markup).toMatch(/CR90 corvette/);
        expect(markup).toMatch(/Return of the Jedi/);
        expect(markup).toMatch(/A New Hope/);
        expect(markup).toMatch(/Planets/);
        expect(markup).toMatch(/Tatooine/);
      });
    });
    it('should work on a non trivial example (Query)', function() {
      class Film extends React.Component<any, any> {
        render() {
          return (
            <Query
              query={gql`
                query data($id: ID!) {
                  film(id: $id) {
                    title
                  }
                }
              `}
              variables={{ id: this.props.id }}
            >
              {({ loading, data }) => {
                if (loading) return null;
                const { film } = data;
                return <h6>{film.title}</h6>;
              }}
            </Query>
          );
        }
      }

      class Starship extends React.Component<any, any> {
        render() {
          return (
            <Query
              query={gql`
                query data($id: ID!) {
                  ship(id: $id) {
                    name
                    films {
                      id
                    }
                  }
                }
              `}
              variables={{ id: this.props.id }}
            >
              {({ data, loading }) => {
                if (loading) return null;
                const { ship } = data;
                return (
                  <div>
                    <h4>{ship.name} appeared in the following flims:</h4>
                    <br />
                    <ul>
                      {ship.films.map((film, key) => (
                        <li key={key}>
                          <Film id={film.id} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }}
            </Query>
          );
        }
      }

      class AllShips extends React.Component<any, any> {
        render() {
          return (
            <Query
              query={gql`
                query data {
                  allShips {
                    id
                  }
                }
              `}
            >
              {({ data, loading }) => {
                return (
                  <ul>
                    {!loading &&
                      data.allShips.map((ship, key) => (
                        <li key={key}>
                          <Starship id={ship.id} />
                        </li>
                      ))}
                  </ul>
                );
              }}
            </Query>
          );
        }
      }

      class AllPlanets extends React.Component<any, any> {
        render() {
          return (
            <Query
              query={gql`
                query data {
                  allPlanets {
                    name
                  }
                }
              `}
            >
              {({ loading, data }) => {
                if (loading) return null;
                return (
                  <div>
                    <h1>Planets</h1>
                    {data.allPlanets.map((planet, key) => (
                      <div key={key}>{planet.name}</div>
                    ))}
                  </div>
                );
              }}
            </Query>
          );
        }
      }

      const Bar = () => (
        <div>
          <h2>Bar</h2>
          <AllPlanets />
        </div>
      );
      const Foo = () => (
        <div>
          <h1>Foo</h1>
          <Bar />
        </div>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <div>
            <Foo />
            <hr />
            <AllShips />
          </div>
        </ApolloProvider>
      );

      return renderToStringWithData(app).then(markup => {
        expect(markup).toMatch(/CR90 corvette/);
        expect(markup).toMatch(/Return of the Jedi/);
        expect(markup).toMatch(/A New Hope/);
        expect(markup).toMatch(/Planets/);
        expect(markup).toMatch(/Tatooine/);
      });
    });
  });
});
