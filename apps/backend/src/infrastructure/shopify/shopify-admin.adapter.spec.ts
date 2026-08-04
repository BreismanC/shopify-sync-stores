import { ShopifyAdminAdapter } from './shopify-admin.adapter';

describe('ShopifyAdminAdapter product publications', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publica el producto en Tienda online y mercados activos', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            publications: {
              nodes: [
                {
                  id: 'online-publication',
                  catalog: null,
                  channels: { nodes: [{ name: 'Online Store' }] },
                },
                {
                  id: 'colombia-market',
                  catalog: { __typename: 'MarketCatalog', status: 'ACTIVE' },
                  channels: { nodes: [] },
                },
                {
                  id: 'archived-market',
                  catalog: {
                    __typename: 'MarketCatalog',
                    status: 'ARCHIVED',
                  },
                  channels: { nodes: [] },
                },
              ],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { publishablePublish: { userErrors: [] } },
        }),
      } as Response);
    const adapter = new ShopifyAdminAdapter({
      getOrThrow: jest.fn().mockReturnValue('2026-07'),
    } as never);

    await expect(
      adapter.publishProduct(
        { shopDomain: 'vendor.myshopify.com', accessToken: 'token' },
        'gid://shopify/Product/1',
      ),
    ).resolves.toEqual({
      publicationIds: ['online-publication', 'colombia-market'],
    });

    const mutationBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    ) as { variables: { id: string; input: Array<{ publicationId: string }> } };
    expect(mutationBody.variables).toEqual({
      id: 'gid://shopify/Product/1',
      input: [
        { publicationId: 'online-publication' },
        { publicationId: 'colombia-market' },
      ],
    });
  });
});
