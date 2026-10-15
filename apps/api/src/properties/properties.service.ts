import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.property.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { units: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        units: { orderBy: { unitNumber: 'asc' } },
        _count: { select: { units: true } },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property with id "${id}" not found`);
    }

    return property;
  }

  async create(dto: CreatePropertyDto, ownerId: string) {
    return this.prisma.property.create({
      data: {
        ...dto,
        ownerId,
      },
    });
  }

  async update(id: string, dto: UpdatePropertyDto) {
    await this.findOne(id); // throws NotFoundException if not found
    return this.prisma.property.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.property.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
