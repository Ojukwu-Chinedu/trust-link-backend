export class ContractCallFailedException extends Error {
  constructor(message = 'Soroban contract call failed') {
    super(message);
    this.name = ContractCallFailedException.name;
  }
}
