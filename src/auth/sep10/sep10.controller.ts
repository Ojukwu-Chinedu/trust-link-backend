import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { IsStellarAddress } from '../../common/validators/stellar-address.validator';
import { Sep10Service } from './sep10.service';

class ChallengeRequestDto {
  @IsString()
  @IsStellarAddress()
  publicKey!: string;
}

class VerifyChallengeDto {
  @IsString()
  @MinLength(1)
  transaction!: string;
}

@Controller('auth')
export class Sep10Controller {
  constructor(private readonly sep10Service: Sep10Service) {}

  /** GET /auth?account=<G...> — issue a SEP-10 challenge (legacy) */
  @Get()
  challengeGet(@Query('account') account: string) {
    return { transaction: this.sep10Service.buildChallenge(account) };
  }

  /**
   * POST /auth/challenge { publicKey }
   * Issues a SEP-10 challenge transaction (unsigned XDR) for Freighter to sign.
   * Challenge expires in 15 minutes.
   */
  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  challengePost(@Body() dto: ChallengeRequestDto) {
    return {
      transaction: this.sep10Service.buildChallenge(dto.publicKey, 900),
      network_passphrase: this.sep10Service.getNetworkPassphrase(),
    };
  }

  /** POST /auth { transaction: "<signed-base64-xdr>" } — verify and issue JWT */
  @Post()
  verify(@Body() dto: VerifyChallengeDto) {
    const token = this.sep10Service.verifyAndIssueToken(dto.transaction);
    return { token };
  }
}
