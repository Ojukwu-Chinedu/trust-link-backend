import axios from 'axios';
import { HorizonService } from '../../src/stellar/horizon.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HorizonService.pollConfirmation (issue #50)', () => {
  let service: HorizonService;

  beforeEach(() => {
    service = new HorizonService();
    mockedAxios.get.mockReset();
  });

  it('resolves when target confirmations are reached', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ status: 200, data: { confirmations: 1 } })
      .mockResolvedValueOnce({ status: 200, data: { confirmations: 2 } })
      .mockResolvedValueOnce({ status: 200, data: { confirmations: 3 } });

    const result = await service.pollConfirmation('tx-hash', 3, 1000);

    expect(result).toEqual({
      confirmed: true,
      confirmations: 3,
      hash: 'tx-hash',
    });
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('throws a timeout error when confirmations never reach the target', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: { confirmations: 0 } });

    await expect(service.pollConfirmation('tx-hash', 2, 350)).rejects.toThrow(
      'Horizon confirmation timed out',
    );
    expect(mockedAxios.get).toHaveBeenCalled();
  });
});
