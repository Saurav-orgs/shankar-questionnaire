import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Doctor } from '../models';

export interface DoctorProfile {
  id: string;
  fullName: string;
  qualifications: string | null;
  specialty: string | null;
  bio: string | null;
  photoUrl: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  clinicPhone: string | null;
  emergencyPhone: string | null;
}

@Injectable()
export class DoctorsService {
  constructor(@InjectModel(Doctor) private readonly doctors: typeof Doctor) {}

  /** The POC has a single doctor. Multi-tenancy is out of scope — plan.md §15. */
  async getPrimary(): Promise<Doctor> {
    const doctor = await this.doctors.findOne({
      order: [['createdAt', 'ASC']],
    });
    if (!doctor) {
      throw new NotFoundException('No doctor configured. Run `npm run seed`.');
    }
    return doctor;
  }

  toProfile(doctor: Doctor, lang: 'en' | 'hi'): DoctorProfile {
    return {
      id: doctor.id,
      fullName: doctor.fullName,
      qualifications: doctor.qualifications,
      specialty: doctor.specialty,
      bio: lang === 'hi' ? (doctor.bioHi ?? doctor.bioEn) : doctor.bioEn,
      photoUrl: doctor.photoUrl,
      clinicName: doctor.clinicName,
      clinicAddress: doctor.clinicAddress,
      clinicPhone: doctor.clinicPhone,
      emergencyPhone: doctor.emergencyPhone,
    };
  }
}
