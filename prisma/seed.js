/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// Cargar datos transpilados completos de la ESPOL
const { careers, faculties } = require(path.join(__dirname, "../espol_malla_transpiled.cjs"));

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function main() {
  console.log("🌱 [ESPOL OFICIAL] Iniciando sincronización de las 34 carreras y 742 materias...");

  // 1. Limpiar datos previos manteniendo integridad
  await prisma.careerSubject.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.career.deleteMany({});

  console.log("🧹 Base de datos limpia.");

  // 2. Crear Usuarios Demo
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@espol.edu.ec" },
    update: {},
    create: {
      email: "admin@espol.edu.ec",
      name: "Administrador Académico ESPOL",
      role: "ADMIN",
      approvedContributions: 25,
      image: "https://api.dicebear.com/7.x/bottts/svg?seed=admin_espol",
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "estudiante@espol.edu.ec" },
    update: {},
    create: {
      email: "estudiante@espol.edu.ec",
      name: "Aidan Politécnico",
      role: "STUDENT",
      approvedContributions: 6,
      image: "https://api.dicebear.com/7.x/bottts/svg?seed=aidan_espol",
    },
  });

  // 3. Crear Carreras de ESPOL
  const facultyMap = new Map();
  if (faculties) {
    faculties.forEach((f) => facultyMap.set(f.id, f.name));
  }

  const createdCareers = new Map(); // id -> Career model

  for (const career of careers) {
    const code = career.id.toUpperCase();
    const facultyName = facultyMap.get(career.facultyId) || career.facultyId || "ESPOL";
    const slug = slugify(career.name);

    const created = await prisma.career.create({
      data: {
        code,
        name: career.name,
        slug,
        faculty: facultyName,
        description: `Carrera oficial de la ${facultyName} en la ESPOL.`,
      },
    });

    createdCareers.set(career.id, created);
  }

  console.log(`✅ ${createdCareers.size} Carreras registradas en la base de datos.`);

  // 4. Agrupar materias únicas y relaciones
  const subjectsMap = new Map(); // code -> { code, name, slug, careers: [{ careerId, semester }] }

  for (const career of careers) {
    const careerModel = createdCareers.get(career.id);
    if (!careerModel) continue;

    for (const s of career.subjects || []) {
      const rawCode = (s.code || s.id || "").trim().toUpperCase();
      const name = (s.name || "").trim();

      // Omitir genéricas de relleno
      if (
        !rawCode ||
        (rawCode.startsWith("COMP") && name.toLowerCase().includes("complementaria")) ||
        (rawCode.startsWith("ITI") && name.toLowerCase() === "itinerario")
      ) {
        continue;
      }

      // Convertir period a semestre numérico
      let semester = 1;
      if (s.period) {
        const p = s.period.toLowerCase();
        if (p.includes("100 - i") && !p.includes("ii")) semester = 1;
        else if (p.includes("100 - ii")) semester = 2;
        else if (p.includes("200 - i") && !p.includes("ii")) semester = 3;
        else if (p.includes("200 - ii")) semester = 4;
        else if (p.includes("300 - i") && !p.includes("ii")) semester = 5;
        else if (p.includes("300 - ii")) semester = 6;
        else if (p.includes("400 - i") && !p.includes("ii")) semester = 7;
        else if (p.includes("400 - ii")) semester = 8;
        else if (p.includes("500")) semester = 9;
      }

      const code = rawCode;

      if (!subjectsMap.has(code)) {
        subjectsMap.set(code, {
          code,
          name,
          slug: `${slugify(name)}-${code.toLowerCase()}`,
          relations: [],
        });
      }

      subjectsMap.get(code).relations.push({
        careerId: careerModel.id,
        semester,
      });
    }
  }

  console.log(`⏳ Insertando ${subjectsMap.size} materias oficiales únicas y sus relaciones compartidas...`);

  let createdSubjectsCount = 0;
  let createdRelationsCount = 0;

  for (const [code, data] of subjectsMap.entries()) {
    const subject = await prisma.subject.create({
      data: {
        code: data.code,
        name: data.name,
        slug: data.slug,
        description: `Materia oficial de la ESPOL (${data.code}).`,
      },
    });

    createdSubjectsCount++;

    // Evitar duplicados de la misma carrera en la misma materia
    const seenCareers = new Set();

    for (const rel of data.relations) {
      if (seenCareers.has(rel.careerId)) continue;
      seenCareers.add(rel.careerId);

      await prisma.careerSubject.create({
        data: {
          careerId: rel.careerId,
          subjectId: subject.id,
          semester: rel.semester,
        },
      });

      createdRelationsCount++;
    }

    // Insertar documentos de muestra en materias emblemáticas de la ESPOL
    if (code === "MATG1045") {
      // Cálculo de una Variable
      await prisma.document.create({
        data: {
          title: "Examen Parcial Resuelto - Cálculo de una Variable 2025-1T",
          description: "Resolución oficial paso a paso de optimización, límites con L'Hôpital e integración por partes.",
          fileHash: "hash-espol-calculo-parcial-2025",
          fileSize: 3200000,
          mimeType: "application/pdf",
          storageKey: "espol/MATG1045/parcial-calculo-2025.pdf",
          fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          category: "EXAMEN",
          subcategory: "Parcial",
          periodYear: 2025,
          periodTerm: "1T",
          downloadCount: 340,
          subjectId: subject.id,
          uploadedById: adminUser.id,
        },
      });

      await prisma.document.create({
        data: {
          title: "Lección 1: Límites trigonométricos y Continuidad",
          description: "4 temas resueltos con demostraciones épsilon-delta.",
          fileHash: "hash-espol-calculo-leccion-1",
          fileSize: 1450000,
          mimeType: "application/pdf",
          storageKey: "espol/MATG1045/leccion-1.pdf",
          fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          category: "LECCION",
          subcategory: "Lección 1",
          periodYear: 2025,
          periodTerm: "2T",
          downloadCount: 198,
          subjectId: subject.id,
          uploadedById: studentUser.id,
        },
      });
    }

    if (code === "CCPG1043" || code === "CCPG1001") {
      // Fundamentos de Programación
      await prisma.document.create({
        data: {
          title: "Taller 2: Manejo de Diccionarios y Funciones en Python",
          description: "Guía práctica con ejercicios de estructuras de datos básicas y listas anidadas.",
          fileHash: `hash-espol-fp-taller-2-${code}`,
          fileSize: 1100000,
          mimeType: "application/pdf",
          storageKey: `espol/${code}/taller-2-fp.pdf`,
          fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          category: "TALLER",
          subcategory: "Taller 2",
          periodYear: 2025,
          periodTerm: "1T",
          downloadCount: 145,
          subjectId: subject.id,
          uploadedById: studentUser.id,
        },
      });
    }

    if (code === "CCPG1005") {
      // Estructuras de Datos
      await prisma.document.create({
        data: {
          title: "Examen Final: Árboles B, Grafos y Algoritmo de Dijkstra",
          description: "Examen final resuelto con pseudocódigo e implementación en Java.",
          fileHash: "hash-espol-ed-examen-final-2025",
          fileSize: 2800000,
          mimeType: "application/pdf",
          storageKey: "espol/CCPG1005/final-ed.pdf",
          fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          category: "EXAMEN",
          subcategory: "Final",
          periodYear: 2025,
          periodTerm: "1T",
          downloadCount: 265,
          subjectId: subject.id,
          uploadedById: adminUser.id,
        },
      });
    }
  }

  console.log(`\n🎉 [ESPOL OFICIAL] Sincronización exitosa:`);
  console.log(`   - ${createdCareers.size} Carreras universitarias`);
  console.log(`   - ${createdSubjectsCount} Materias únicas indexadas`);
  console.log(`   - ${createdRelationsCount} Relaciones de materias compartidas creadas`);
}

main()
  .catch((e) => {
    console.error("Error en seed oficial ESPOL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
