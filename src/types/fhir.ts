// FHIR R4 TypeScript Types
// Based on HL7 FHIR Release 4 (R4) specification

export type FHIRDate = string;
export type FHIRDateTime = string;
export type FHIRInstant = string;
export type FHIRTime = string;

export interface FHIRMeta {
  versionId?: string;
  lastUpdated?: FHIRInstant;
  source?: string;
  profile?: string[];
  security?: FHIRCoding[];
  tag?: FHIRCoding[];
}

export interface FHIRIdentifier {
  use?: "usual" | "official" | "temp" | "secondary" | "old";
  type?: FHIRCodeableConcept;
  system?: string;
  value?: string;
  period?: FHIRPeriod;
  assigner?: FHIRReference;
}

export interface FHIRHumanName {
  use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: FHIRPeriod;
}

export interface FHIRContactPoint {
  system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
  value?: string;
  use?: "home" | "work" | "temp" | "old" | "mobile";
  rank?: number;
  period?: FHIRPeriod;
}

export interface FHIRAddress {
  use?: "home" | "work" | "temp" | "old" | "billing";
  type?: "postal" | "physical" | "both";
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: FHIRPeriod;
}

export interface FHIRPeriod {
  start?: FHIRDateTime;
  end?: FHIRDateTime;
}

export interface FHIRAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: FHIRDateTime;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRQuantity {
  value?: number;
  comparator?: "<" | "<=" | ">=" | ">";
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
}

export interface FHIRRatio {
  numerator?: FHIRQuantity;
  denominator?: FHIRQuantity;
}

export interface FHIRReference {
  reference?: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRAnnotation {
  authorString?: string;
  authorReference?: FHIRReference;
  time?: FHIRDateTime;
  text: string;
}

// DomainResource base
export interface FHIRDomainResource {
  id?: string;
  meta?: FHIRMeta;
  implicitRules?: string;
  language?: string;
  text?: FHIRNarrative;
  contained?: FHIRResource[];
  extension?: FHIRExtension[];
  modifierExtension?: FHIRExtension[];
}

export interface FHIRResource extends FHIRDomainResource {
  resourceType: string;
}

export interface FHIRNarrative {
  status: "generated" | "extensions" | "additional" | "empty";
  div: string;
}

export interface FHIRExtension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDate?: FHIRDate;
  valueDateTime?: FHIRDateTime;
  valueTime?: FHIRTime;
  valueCode?: string;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueCoding?: FHIRCoding;
  valueQuantity?: FHIRQuantity;
  valueReference?: FHIRReference;
  valueAddress?: FHIRAddress;
  valueContactPoint?: FHIRContactPoint;
  valueHumanName?: FHIRHumanName;
  valueAttachment?: FHIRAttachment;
  valueIdentifier?: FHIRIdentifier;
  extension?: FHIRExtension[];
}

// Patient Resource (FHIR R4)
export interface FHIRPatient extends FHIRResource {
  resourceType: "Patient";
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: FHIRDate;
  deceasedBoolean?: boolean;
  deceasedDateTime?: FHIRDateTime;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: FHIRAttachment[];
  contact?: FHIRPatientContact[];
  communication?: FHIRPatientCommunication[];
  generalPractitioner?: FHIRReference[];
  managingOrganization?: FHIRReference;
  link?: FHIRPatientLink[];
}

export interface FHIRPatientContact {
  relationship?: FHIRCodeableConcept[];
  name?: FHIRHumanName;
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
  gender?: "male" | "female" | "other" | "unknown";
  organization?: FHIRReference;
  period?: FHIRPeriod;
}

export interface FHIRPatientCommunication {
  language: FHIRCodeableConcept;
  preferred?: boolean;
}

export interface FHIRPatientLink {
  other: FHIRReference;
  type: "replaced-by" | "replaces" | "refer" | "seealso";
}

// Practitioner Resource
export interface FHIRPractitioner extends FHIRResource {
  resourceType: "Practitioner";
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: FHIRDate;
  photo?: FHIRAttachment[];
  qualification?: FHIRPractitionerQualification[];
  communication?: FHIRCodeableConcept[];
}

export interface FHIRPractitionerQualification {
  identifier?: FHIRIdentifier[];
  code: FHIRCodeableConcept;
  period?: FHIRPeriod;
  issuer?: FHIRReference;
}

// Organization Resource
export interface FHIROrganization extends FHIRResource {
  resourceType: "Organization";
  identifier?: FHIRIdentifier[];
  active?: boolean;
  type?: FHIRCodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  partOf?: FHIRReference;
  contact?: FHIROrganizationContact[];
  endpoint?: FHIRReference[];
}

export interface FHIROrganizationContact {
  purpose?: FHIRCodeableConcept;
  name?: FHIRHumanName;
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
}

// Observation Resource
export interface FHIRObservation extends FHIRResource {
  resourceType: "Observation";
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  partOf?: FHIRReference[];
  status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled" | "entered-in-error" | "unknown";
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  focus?: FHIRReference[];
  encounter?: FHIRReference;
  effectiveDateTime?: FHIRDateTime;
  effectivePeriod?: FHIRPeriod;
  effectiveTiming?: unknown;
  effectiveInstant?: FHIRInstant;
  issued?: FHIRInstant;
  performer?: FHIRReference[];
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueSampledData?: unknown;
  valueTime?: FHIRTime;
  valueDateTime?: FHIRDateTime;
  valuePeriod?: FHIRPeriod;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  note?: FHIRAnnotation[];
  bodySite?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  specimen?: FHIRReference;
  device?: FHIRReference;
  referenceRange?: FHIRObservationReferenceRange[];
  hasMember?: FHIRReference[];
  derivedFrom?: FHIRReference[];
  component?: FHIRObservationComponent[];
}

export interface FHIRObservationReferenceRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
  type?: FHIRCodeableConcept;
  appliesTo?: FHIRCodeableConcept[];
  age?: FHIRRange;
  text?: string;
}

export interface FHIRObservationComponent {
  code: FHIRCodeableConcept;
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueSampledData?: unknown;
  valueTime?: FHIRTime;
  valueDateTime?: FHIRDateTime;
  valuePeriod?: FHIRPeriod;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  referenceRange?: FHIRObservationReferenceRange[];
}

// Condition Resource
export interface FHIRCondition extends FHIRResource {
  resourceType: "Condition";
  identifier?: FHIRIdentifier[];
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  severity?: FHIRCodeableConcept;
  code?: FHIRCodeableConcept;
  bodySite?: FHIRCodeableConcept[];
  subject: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: FHIRDateTime;
  onsetAge?: unknown;
  onsetPeriod?: FHIRPeriod;
  onsetRange?: FHIRRange;
  onsetString?: string;
  abatementDateTime?: FHIRDateTime;
  abatementAge?: unknown;
  abatementPeriod?: FHIRPeriod;
  abatementRange?: FHIRRange;
  abatementString?: string;
  recordedDate?: FHIRDateTime;
  recorder?: FHIRReference;
  asserter?: FHIRReference;
  stage?: FHIRConditionStage[];
  evidence?: FHIRConditionEvidence[];
  note?: FHIRAnnotation[];
}

export interface FHIRConditionStage {
  summary?: FHIRCodeableConcept;
  type?: FHIRCodeableConcept;
  assessment?: FHIRReference[];
}

export interface FHIRConditionEvidence {
  code?: FHIRCodeableConcept[];
  detail?: FHIRReference[];
}

// Encounter Resource
export interface FHIREncounter extends FHIRResource {
  resourceType: "Encounter";
  identifier?: FHIRIdentifier[];
  status: "planned" | "arrived" | "triaged" | "in-progress" | "onleave" | "finished" | "cancelled" | "entered-in-error" | "unknown";
  statusHistory?: FHIREncounterStatusHistory[];
  class: FHIRCoding;
  classHistory?: FHIREncounterClassHistory[];
  type?: FHIRCodeableConcept[];
  serviceType?: FHIRCodeableConcept;
  priority?: FHIRCodeableConcept;
  subject?: FHIRReference;
  episodeOfCare?: FHIRReference[];
  basedOn?: FHIRReference[];
  participant?: FHIREncounterParticipant[];
  appointment?: FHIRReference[];
  period?: FHIRPeriod;
  length?: unknown;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  diagnosis?: FHIREncounterDiagnosis[];
  account?: FHIRReference[];
  hospitalization?: FHIREncounterHospitalization;
  location?: FHIREncounterLocation[];
  serviceProvider?: FHIRReference;
  partOf?: FHIRReference;
}

export interface FHIREncounterStatusHistory {
  status: string;
  period: FHIRPeriod;
}

export interface FHIREncounterClassHistory {
  class: FHIRCoding;
  period: FHIRPeriod;
}

export interface FHIREncounterParticipant {
  type?: FHIRCodeableConcept[];
  period?: FHIRPeriod;
  individual?: FHIRReference;
}

export interface FHIREncounterDiagnosis {
  condition: FHIRReference;
  use?: FHIRCodeableConcept;
  rank?: number;
}

export interface FHIREncounterHospitalization {
  preAdmissionIdentifier?: FHIRIdentifier;
  origin?: FHIRReference;
  admitSource?: FHIRCodeableConcept;
  reAdmission?: FHIRCodeableConcept;
  dietPreference?: FHIRCodeableConcept[];
  specialCourtesy?: FHIRCodeableConcept[];
  specialArrangement?: FHIRCodeableConcept[];
  destination?: FHIRReference;
  dischargeDisposition?: FHIRCodeableConcept;
}

export interface FHIREncounterLocation {
  location: FHIRReference;
  status?: "planned" | "active" | "reserved" | "completed";
  physicalType?: FHIRCodeableConcept;
  period?: FHIRPeriod;
}

// Bundle Resource
export interface FHIRBundle extends FHIRResource {
  resourceType: "Bundle";
  identifier?: FHIRIdentifier;
  type: "document" | "message" | "transaction" | "transaction-response" | "batch" | "batch-response" | "history" | "searchset" | "collection";
  timestamp?: FHIRInstant;
  total?: number;
  link?: FHIRBundleLink[];
  entry?: FHIRBundleEntry[];
  signature?: unknown;
}

export interface FHIRBundleLink {
  relation: string;
  url: string;
}

export interface FHIRBundleEntry {
  link?: FHIRBundleLink[];
  fullUrl?: string;
  resource?: FHIRResource;
  search?: FHIRBundleEntrySearch;
  request?: FHIRBundleEntryRequest;
  response?: FHIRBundleEntryResponse;
}

export interface FHIRBundleEntrySearch {
  mode?: "match" | "include" | "outcome";
  score?: number;
}

export interface FHIRBundleEntryRequest {
  method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: FHIRInstant;
  ifMatch?: string;
  ifNoneExist?: string;
}

export interface FHIRBundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: FHIRInstant;
  outcome?: FHIRResource;
}

// OperationOutcome Resource
export interface FHIROperationOutcome extends FHIRResource {
  resourceType: "OperationOutcome";
  issue: FHIROperationOutcomeIssue[];
}

export interface FHIROperationOutcomeIssue {
  severity: "fatal" | "error" | "warning" | "information";
  code: string;
  details?: FHIRCodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

// Search Parameters
export interface FHIRSearchParams {
  [key: string]: string | string[] | undefined;
}

// Common Code Systems
export const FHIRCodeSystems = {
  ADMINISTRATIVE_GENDER: "http://hl7.org/fhir/administrative-gender",
  MARITAL_STATUS: "http://hl7.org/fhir/marital-status",
  CONTACT_ENTITY_TYPE: "http://hl7.org/fhir/contactentity-type",
  ENCOUNTER_CLASS: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  ENCOUNTER_STATUS: "http://hl7.org/fhir/encounter-status",
  OBSERVATION_STATUS: "http://hl7.org/fhir/observation-status",
  CONDITION_VERIFICATION_STATUS: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
  CONDITION_CLINICAL_STATUS: "http://terminology.hl7.org/CodeSystem/condition-clinical",
  IDENTIFIER_TYPE: "http://terminology.hl7.org/CodeSystem/v2-0203",
  LOINC: "http://loinc.org",
  SNOMED_CT: "http://snomed.info/sct",
  ICD_10_CM: "http://hl7.org/fhir/sid/icd-10-cm",
  CPT: "http://www.ama-assn.org/go/cpt",
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
} as const;
