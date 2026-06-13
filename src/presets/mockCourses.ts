import type { Course } from "../models/course";

export const requirementCourses: Course[] = [
  {
    code: "CBUX-0000",
    name: "CBU",
    credits: 2,
    department: "CBUX",
  },
  {
    code: "CLEX-0000",
    name: "Creditos de Libre Eleccion",
    credits: 3,
    department: "CLEX",
  },
  {
    code: "ECXX-0000",
    name: "Electiva Cientifica",
    credits: 3,
    department: "ECXX",
  },
  {
    code: "EING-0000",
    name: "Electiva de Ingenieria",
    credits: 3,
    department: "EING",
  },
  {
    code: "EPXX-0000",
    name: "Electiva Profesional",
    credits: 3,
    department: "EPXX",
  },
];

export const mockCourses: Course[] = [
  ...requirementCourses,
  {
    code: "ISIS-1204",
    name: "Algoritmica y Programacion Orientada por Objetos I",
    credits: 3,
    department: "ISIS",
  },
  {
    code: "ISIS-1221",
    name: "Introduccion a la Programacion",
    credits: 3,
    department: "ISIS",
  },
  {
    code: "ISIS-1225",
    name: "Estructuras de Datos y Algoritmos",
    credits: 3,
    department: "ISIS",
  },
  {
    code: "MATE-1203",
    name: "Calculo Diferencial",
    credits: 3,
    department: "MATE",
  },
  {
    code: "FISI-1018",
    name: "Fisica I",
    credits: 3,
    department: "FISI",
  },
  {
    code: "CBCC-1177",
    name: "Constitucion y Democracia",
    credits: 2,
    department: "CBCC",
  },
];
