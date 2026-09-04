import { FirestoreService } from '../src/common/firestore.service';
import * as bcrypt from 'bcrypt';

async function main() {
  const db = new FirestoreService();
  const existingRuleSet = await db.scoringRuleSet.findFirst({ where: { name: 'Standard T20' } });
  if (!existingRuleSet) {
    await db.scoringRuleSet.create({ data: {
      name: 'Standard T20', matchType: 'T20I',
      rules: { run: 1, four_bonus: 1, six_bonus: 2, half_century_bonus: 8, century_bonus: 16, duck_penalty: -2, wicket: 25, three_wicket_bonus: 4, five_wicket_bonus: 8, maiden_over: 4, catch: 8, stumping: 12, run_out: 6, captain_multiplier: 2, vice_captain_multiplier: 1.5 },
    }});
    console.log('Seeded Standard T20 scoring rule set.');
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword && !(await db.user.findFirst({ where: { email: adminEmail } }))) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.user.create({ data: { email: adminEmail, passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), profile: { create: { displayName: 'Super Admin' } }, wallet: { create: {} } } });
    console.log(`Seeded super admin: ${adminEmail}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
