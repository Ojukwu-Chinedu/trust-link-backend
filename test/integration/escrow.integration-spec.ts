/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('POST /escrow integration (issue #20)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.reset();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a DB record and returns 201 for a valid request', async () => {
    const response = await request(app.getHttpServer())
      .post('/escrow')
      .set('Authorization', 'Bearer vendor-address')
      .send({
        itemName: 'Vintage jacket',
        amount: 75,
        currency: 'USDC',
        buyerAddress: 'buyer-address',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        itemName: 'Vintage jacket',
        amount: 75,
        vendorAddress: 'vendor-address',
        buyerAddress: 'buyer-address',
        state: 'FUNDED',
      }),
    );
    await expect(
      prisma.escrow.findUnique({ where: { id: response.body.id } }),
    ).resolves.toEqual(expect.objectContaining({ id: response.body.id }));
  });

  it('returns 400 with validation errors for missing required fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/escrow')
      .set('Authorization', 'Bearer vendor-address')
      .send({ itemName: 'Hat' })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('amount'),
        expect.stringContaining('currency'),
        expect.stringContaining('buyerAddress'),
      ]),
    );
  });

  it('returns 401 for unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/escrow')
      .send({
        itemName: 'Vintage jacket',
        amount: 75,
        currency: 'USDC',
        buyerAddress: 'buyer-address',
      })
      .expect(401);
  });

  it('retrieves a created escrow via GET /escrow/:id', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/escrow')
      .set('Authorization', 'Bearer vendor-address')
      .send({
        itemName: 'Vintage jacket',
        amount: 75,
        currency: 'USDC',
        buyerAddress: 'buyer-address',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/escrow/${createResponse.body.id}`)
      .set('Authorization', 'Bearer buyer-address')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            id: createResponse.body.id,
            itemName: 'Vintage jacket',
          }),
        );
      });
  });
});
