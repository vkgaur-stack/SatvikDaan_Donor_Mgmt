export async function GET(request: NextRequest) {
  return protectedRoute(
    async (req: NextRequest, user: AuthUser) => {
      try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        // List all beneficiaries for the organization
        const [beneficiaries, total] = await Promise.all([
          prisma.beneficiary.findMany({
            where: { organizationId: user.organizationId, deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              gender: true,
              dateOfBirth: true,
              address: true,
              enrollmentStatus: true,
              createdAt: true,
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.beneficiary.count({
            where: { organizationId: user.organizationId, deletedAt: null },
          }),
        ]);

        // Decrypt PII fields
        const decryptedBeneficiaries = beneficiaries.map(b => ({
          ...b,
          phone: decryptField(b.phone || ''),
          email: decryptField(b.email || ''),
          address: decryptField(b.address || ''),
        }));

        await createAuditLog(
          user.organizationId,
          user.id,
          'list',
          'beneficiaries',
          '',
          req
        );

        return successResponse(
          {
            data: decryptedBeneficiaries,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit),
            },
          },
          200
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
    ['admin', 'program_manager', 'field_worker']
  )(request);
}
