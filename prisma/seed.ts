import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seeds Prisma data only. Clerk users + role metadata are seeded
// separately by scripts/seed-clerk-users.ts — run that AFTER this.

async function main() {
  console.log("Clearing existing data...");
  await prisma.approval.deleteMany();
  await prisma.billingLineItem.deleteMany();
  await prisma.billingPeriod.deleteMany();
  await prisma.changeOrder.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding users...");
  const admin = await prisma.user.create({
    data: {
      email: "admin@vance.com",
      name: "Admin User",
      role: "admin"
    }
  });

  const pm1 = await prisma.user.create({
    data: {
      email: "pm1@vance.com",
      name: "Pat Martinez",
      role: "pm"
    }
  });

  const pm2 = await prisma.user.create({
    data: {
      email: "pm2@vance.com",
      name: "Morgan Lee",
      role: "pm"
    }
  });

  const sub1 = await prisma.user.create({
    data: {
      email: "sub1@acme.com",
      name: "Alex Contractor",
      role: "subcontractor",
      companyName: "Acme Construction"
    }
  });

  const sub2 = await prisma.user.create({
    data: {
      email: "sub2@paving.com",
      name: "Priya Singh",
      role: "subcontractor",
      companyName: "Elite Paving Co"
    }
  });

  const sub3 = await prisma.user.create({
    data: {
      email: "sub3@grading.com",
      name: "Jordan Reyes",
      role: "subcontractor",
      companyName: "Titan Grading & Excavation"
    }
  });

  console.log("Seeding projects...");

  const proj1 = await prisma.project.create({
    data: {
      projectNumber: "VC-2026-001",
      name: "Main Street Rehabilitation",
      client: "City of Franklin",
      contractValue: 2850000,
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-11-30"),
      status: "active",
      pmId: pm1.id
    }
  });

  const proj2 = await prisma.project.create({
    data: {
      projectNumber: "VC-2026-002",
      name: "Highway 52 Expansion Phase II",
      client: "Dakota County",
      contractValue: 4200000,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2027-04-30"),
      status: "active",
      pmId: pm2.id
    }
  });

  const proj3 = await prisma.project.create({
    data: {
      projectNumber: "VC-2025-017",
      name: "Cedar Lake Parkway Resurfacing",
      client: "City of Cedar Lake",
      contractValue: 1150000,
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-12-15"),
      status: "completed",
      pmId: pm1.id
    }
  });

  console.log("Seeding contracts and line items...");

  const c1 = await prisma.contract.create({
    data: {
      projectId: proj1.id,
      subId: sub1.id,
      contractValue: 450000,
      description: "Concrete curbs, gutters, and sidewalks",
      lineItems: {
        create: [
          { itemNumber: "01", description: "Mobilization & Demobilization", contractType: "lump_sum", scheduledValue: 25000 },
          { itemNumber: "02", description: "Concrete Curb & Gutter (new install)", contractType: "lump_sum", scheduledValue: 185000 },
          { itemNumber: "03", description: "Concrete Sidewalk Replacement", contractType: "lump_sum", scheduledValue: 140000 },
          { itemNumber: "04", description: "ADA Ramp Construction", contractType: "lump_sum", scheduledValue: 70000 },
          { itemNumber: "05", description: "Final Cleanup & Restoration", contractType: "lump_sum", scheduledValue: 30000 }
        ]
      }
    },
    include: { lineItems: true }
  });

  const c2 = await prisma.contract.create({
    data: {
      projectId: proj1.id,
      subId: sub2.id,
      contractValue: 780000,
      description: "Asphalt paving and striping",
      lineItems: {
        create: [
          { itemNumber: "01", description: "Asphalt Base Course", contractType: "unit_price", unit: "TON", unitPrice: 95, scheduledQty: 4000, scheduledValue: 380000 },
          { itemNumber: "02", description: "Asphalt Surface Course", contractType: "unit_price", unit: "TON", unitPrice: 110, scheduledQty: 2600, scheduledValue: 286000 },
          { itemNumber: "03", description: "Pavement Marking", contractType: "unit_price", unit: "LF", unitPrice: 2.8, scheduledQty: 25000, scheduledValue: 70000 },
          { itemNumber: "04", description: "Traffic Control", contractType: "lump_sum", scheduledValue: 44000 }
        ]
      }
    },
    include: { lineItems: true }
  });

  const c3 = await prisma.contract.create({
    data: {
      projectId: proj2.id,
      subId: sub3.id,
      contractValue: 1250000,
      description: "Site grading, excavation, and embankment",
      lineItems: {
        create: [
          { itemNumber: "01", description: "Clearing & Grubbing", contractType: "lump_sum", scheduledValue: 85000 },
          { itemNumber: "02", description: "Common Excavation", contractType: "unit_price", unit: "CY", unitPrice: 12.5, scheduledQty: 42000, scheduledValue: 525000 },
          { itemNumber: "03", description: "Borrow Embankment", contractType: "unit_price", unit: "CY", unitPrice: 18, scheduledQty: 28000, scheduledValue: 504000 },
          { itemNumber: "04", description: "Erosion Control", contractType: "lump_sum", scheduledValue: 136000 }
        ]
      }
    },
    include: { lineItems: true }
  });

  const c4 = await prisma.contract.create({
    data: {
      projectId: proj2.id,
      subId: sub2.id,
      contractValue: 1850000,
      description: "Hot mix asphalt paving, HW52 mainline and shoulders",
      lineItems: {
        create: [
          { itemNumber: "01", description: "HMA Base, Type B", contractType: "unit_price", unit: "TON", unitPrice: 98, scheduledQty: 9500, scheduledValue: 931000 },
          { itemNumber: "02", description: "HMA Surface, Type C", contractType: "unit_price", unit: "TON", unitPrice: 112, scheduledQty: 6200, scheduledValue: 694400 },
          { itemNumber: "03", description: "Tack Coat", contractType: "unit_price", unit: "GAL", unitPrice: 3.25, scheduledQty: 8000, scheduledValue: 26000 },
          { itemNumber: "04", description: "Pavement Striping & Markings", contractType: "lump_sum", scheduledValue: 122600 },
          { itemNumber: "05", description: "Traffic Control & MOT", contractType: "lump_sum", scheduledValue: 76000 }
        ]
      }
    },
    include: { lineItems: true }
  });

  console.log("Seeding a submitted billing period for PM review...");

  const bp1 = await prisma.billingPeriod.create({
    data: {
      projectId: proj1.id,
      contractId: c1.id,
      subId: sub1.id,
      periodMonth: 3,
      periodYear: 2026,
      status: "submitted",
      submittedAt: new Date("2026-04-02"),
      notes: "March 2026 progress billing — mobilization complete, curb work underway."
    }
  });

  const mkBLI = async (
    lineItem: (typeof c1.lineItems)[number],
    pct: number
  ) => {
    const sv = Number(lineItem.scheduledValue);
    const cum = (sv * pct) / 100;
    return prisma.billingLineItem.create({
      data: {
        billingPeriodId: bp1.id,
        lineItemId: lineItem.id,
        percentComplete: pct,
        valueThisPeriod: cum,
        valueCumulative: cum,
        balanceToFinish: sv - cum
      }
    });
  };
  await mkBLI(c1.lineItems[0], 100);
  await mkBLI(c1.lineItems[1], 35);
  await mkBLI(c1.lineItems[2], 15);
  await mkBLI(c1.lineItems[3], 0);
  await mkBLI(c1.lineItems[4], 0);

  const bp2 = await prisma.billingPeriod.create({
    data: {
      projectId: proj1.id,
      contractId: c2.id,
      subId: sub2.id,
      periodMonth: 2,
      periodYear: 2026,
      status: "approved",
      submittedAt: new Date("2026-03-01"),
      notes: "February 2026 progress — paving base course underway."
    }
  });

  const bliUP = async (li: (typeof c2.lineItems)[number], qty: number) => {
    const up = Number(li.unitPrice || 0);
    const sv = Number(li.scheduledValue);
    const value = up * qty;
    return prisma.billingLineItem.create({
      data: {
        billingPeriodId: bp2.id,
        lineItemId: li.id,
        qtyThisPeriod: qty,
        qtyCumulative: qty,
        valueThisPeriod: value,
        valueCumulative: value,
        balanceToFinish: sv - value
      }
    });
  };
  await bliUP(c2.lineItems[0], 850);
  await bliUP(c2.lineItems[1], 0);
  await bliUP(c2.lineItems[2], 0);

  const tcSv = Number(c2.lineItems[3].scheduledValue);
  const tcVal = tcSv * 0.2;
  await prisma.billingLineItem.create({
    data: {
      billingPeriodId: bp2.id,
      lineItemId: c2.lineItems[3].id,
      percentComplete: 20,
      valueThisPeriod: tcVal,
      valueCumulative: tcVal,
      balanceToFinish: tcSv - tcVal
    }
  });

  await prisma.approval.create({
    data: {
      approverId: pm1.id,
      entityType: "billing_period",
      billingPeriodId: bp2.id,
      decision: "approved",
      comments: "Approved — progress aligns with on-site verification."
    }
  });

  console.log("Seeding change orders...");

  await prisma.changeOrder.create({
    data: {
      projectId: proj1.id,
      coNumber: "CO-001",
      initiatedBy: "sub",
      initiatorId: sub1.id,
      description: "Unforeseen rock encountered during curb excavation on Block 300. Additional rock removal and hauling required.",
      amount: 18500,
      timeImpact: 5,
      timeImpactNote: "Five additional working days to complete rock removal prior to concrete placement.",
      status: "pending",
      notes: "Supporting photos and tonnage log attached via upload."
    }
  });

  await prisma.changeOrder.create({
    data: {
      projectId: proj1.id,
      coNumber: "CO-002",
      initiatedBy: "pm",
      initiatorId: pm1.id,
      description: "City-directed addition of 4 extra ADA ramps at intersections Main/3rd and Main/5th.",
      amount: 42000,
      timeImpact: 10,
      timeImpactNote: "Extends sidewalk completion milestone by ten days.",
      status: "pm_approved"
    }
  });

  await prisma.changeOrder.create({
    data: {
      projectId: proj2.id,
      coNumber: "CO-001",
      initiatedBy: "customer",
      initiatorId: pm2.id,
      description: "Dakota County added drainage structure at STA 142+50 not shown on plans.",
      amount: 67400,
      timeImpact: 0,
      status: "customer_approved",
      customerApprovedAt: new Date("2026-04-05")
    }
  });

  await prisma.changeOrder.create({
    data: {
      projectId: proj2.id,
      coNumber: "CO-002",
      initiatedBy: "sub",
      initiatorId: sub3.id,
      description: "Request for escalation on aggregate material pricing.",
      amount: 24500,
      timeImpact: 0,
      status: "rejected",
      notes: "Rejected — material price risk assumed by sub per contract Section 4.3."
    }
  });

  console.log("Prisma seed complete. Now run:  npx tsx scripts/seed-clerk-users.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
