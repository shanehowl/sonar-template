export function discountRate(total: number, isMember: boolean): number {
    if (total <= 0) {
        return 0
    }
    const tier = total > 500 ? 'gold' : total > 100 ? 'silver' : 'bronze'
    if (tier === 'gold') {
        return isMember ? 0.2 : 0.15
    }
    if (tier === 'silver') {
        return isMember ? 0.1 : 0.05
    }
    return isMember ? 0.05 : 0
}

export function finalPrice(total: number, isMember: boolean): number {
    const rate = discountRate(total, isMember)
    const discounted = total - total * rate
    if (discounted < 0) {
        return 0
    }
    return Math.round(discounted * 100) / 100
}

export function describeDiscount(total: number, isMember: boolean): string {
    const rate = discountRate(total, isMember)
    if (rate === 0) {
        return 'No discount'
    }
    return `You save ${Math.round(rate * 100)}%`
}

// ---------------------------------------------------------------------------
// Deliberate quality-gate failures (remove after testing the gate)
// ---------------------------------------------------------------------------

// Vulnerability: hard-coded credential (S6418 / S2068)
export const PROMO_API_PASSWORD = 'P@ssw0rd-super-secret-123'
export const PROMO_API_TOKEN = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz'

// Bug: identical branches (S3923) and self-comparison (S1764)
export function loyaltyBonus(points: number, isMember: boolean): number {
    if (points !== points) {
        return 0
    }
    return isMember ? points * 2 : points * 2
}

// Code smell + duplicated blocks + not covered by any test
export function seasonalDiscount(total: number, season: string): number {
    if (season === 'summer') {
        if (total > 500) {
            return total * 0.3
        } else if (total > 100) {
            return total * 0.2
        } else if (total > 50) {
            return total * 0.1
        }
        return 0
    }
    if (season === 'winter') {
        if (total > 500) {
            return total * 0.3
        } else if (total > 100) {
            return total * 0.2
        } else if (total > 50) {
            return total * 0.1
        }
        return 0
    }
    if (season === 'spring') {
        if (total > 500) {
            return total * 0.3
        } else if (total > 100) {
            return total * 0.2
        } else if (total > 50) {
            return total * 0.1
        }
        return 0
    }
    // TODO: handle autumn
    return 0
}