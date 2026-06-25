import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, reports, hotels, realEstate, vehicles, trips] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.report.count(),
      this.prisma.hotelProperty.count(),
      this.prisma.realEstateListing.count(),
      this.prisma.vehicleListing.count(),
      this.prisma.tripListing.count(),
    ]);
    return { users, reports, hotels, realEstate, vehicles, trips };
  }
}
