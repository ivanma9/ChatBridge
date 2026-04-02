import { describe, it, expect } from 'vitest'
import { assessRiskFromFindings, combineRiskLevels } from '../../src/review/RiskAssessor'

describe('RiskAssessor', () => {
  describe('assessRiskFromFindings', () => {
    it('should return low for info-only findings', () => {
      expect(assessRiskFromFindings(['info', 'info'])).toBe('low')
    })

    it('should return medium for medium findings', () => {
      expect(assessRiskFromFindings(['info', 'medium'])).toBe('medium')
    })

    it('should return high for high findings', () => {
      expect(assessRiskFromFindings(['low', 'high', 'medium'])).toBe('high')
    })

    it('should return critical for critical findings', () => {
      expect(assessRiskFromFindings(['critical'])).toBe('critical')
    })

    it('should return low for empty findings', () => {
      expect(assessRiskFromFindings([])).toBe('low')
    })
  })

  describe('combineRiskLevels', () => {
    it('should return the higher of two levels', () => {
      expect(combineRiskLevels('low', 'high')).toBe('high')
      expect(combineRiskLevels('critical', 'low')).toBe('critical')
      expect(combineRiskLevels('medium', 'medium')).toBe('medium')
    })
  })
})
