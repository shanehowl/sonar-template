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