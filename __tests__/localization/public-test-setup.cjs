// Never allow the isolated regression suites to make live outbound requests.
global.fetch = jest.fn()