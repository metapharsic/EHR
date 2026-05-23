import { describe, it, expect, vi } from 'vitest';
import { parseSymptoms, getDifferentialDiagnosis } from './clinicalEngine';

describe('Clinical Engine Unit Tests', () => {

  describe('parseSymptoms()', () => {
    it('should correctly extract exact english symptoms', async () => {
      const text = "I have a severe headache and some fever";
      const symptoms = await parseSymptoms(text);
      expect(symptoms).toContain('headache');
      expect(symptoms).toContain('fever');
    });

    it('should correctly map localized Hindi keywords to English', async () => {
      const text = "Mujhe bukhar aur sirdard hai";
      const symptoms = await parseSymptoms(text);
      expect(symptoms).toContain('fever');
      expect(symptoms).toContain('headache');
    });

    it('should correctly map localized Telugu keywords to English', async () => {
      const text = "Naaku jwaram mariyu thala noppi undi";
      const symptoms = await parseSymptoms(text);
      expect(symptoms).toContain('fever');
      expect(symptoms).toContain('headache');
      expect(symptoms).toContain('pain'); // 'noppi'
    });

    it('should handle mixed language seamlessly', async () => {
      const text = "Doctor, mujhe kal raat se severe chest pain aur thakan hai, plus cold.";
      const symptoms = await parseSymptoms(text);
      expect(symptoms).toContain('chest pain');
      expect(symptoms).toContain('fatigue'); // 'thakan'
      expect(symptoms).toContain('cold');
    });
  });

  describe('getDifferentialDiagnosis()', () => {
    it('should return empty array for no symptoms', async () => {
      const result = await getDifferentialDiagnosis([]);
      expect(result).toHaveLength(0);
    });

    it('should identify Upper Respiratory Tract Infection (URI) for common cold symptoms', async () => {
      const symptoms = ['cold', 'cough', 'fever', 'sore throat'];
      const result = await getDifferentialDiagnosis(symptoms);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].diagnosis.name).toBe('Upper Respiratory Tract Infection');
    });

    it('should identify Acute Coronary Syndrome and warn of red flags', async () => {
      const symptoms = ['chest pain', 'sweating', 'pain'];
      const result = await getDifferentialDiagnosis(symptoms);
      
      expect(result.length).toBeGreaterThan(0);
      // ACS should be highly scored for chest pain + sweating
      const acsMatch = result.find(r => r.diagnosis.id === 'acs');
      expect(acsMatch).toBeDefined();
      expect(acsMatch?.score).toBeGreaterThan(30);
    });

    it('should limit results to top 10 matches', async () => {
      const symptoms = ['fever', 'pain', 'weakness', 'cough', 'swelling', 'nausea'];
      const result = await getDifferentialDiagnosis(symptoms);
      expect(result.length).toBeLessThanOrEqual(10);
    });
    
    it('should accurately calculate scores and matched symptoms', async () => {
      const symptoms = ['wheezing', 'breathlessness'];
      const result = await getDifferentialDiagnosis(symptoms);
      
      const asthmaMatch = result.find(r => r.diagnosis.id === 'asthma');
      expect(asthmaMatch).toBeDefined();
      expect(asthmaMatch?.matchedSymptoms).toContain('wheezing');
      expect(asthmaMatch?.matchedSymptoms).toContain('breathlessness');
    });
  });

});
