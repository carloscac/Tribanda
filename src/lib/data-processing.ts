export const DATA_PROCESSING_VERSION = "2026-10-19";
export const DATA_PROCESSING_PATH = "/tratamiento-de-datos";

export function readDataProcessingAccepted(formData: FormData) {
  return formData.get("dataProcessingAccepted") === "on";
}

export function readDataProcessingAttested(formData: FormData) {
  return formData.get("dataProcessingAttested") === "on";
}

export function requireDataProcessingAccepted(formData: FormData) {
  if (!readDataProcessingAccepted(formData)) {
    return { error: "Debes aceptar el tratamiento de datos personales para continuar." };
  }
  return null;
}

export function requireDataProcessingAttested(formData: FormData) {
  if (!readDataProcessingAttested(formData)) {
    return {
      error:
        "Debes declarar que el deportista autorizó el tratamiento de sus datos personales.",
    };
  }
  return null;
}

export function dataProcessingAcceptanceWrite() {
  return {
    dataProcessingAcceptedAt: new Date(),
    dataProcessingVersion: DATA_PROCESSING_VERSION,
  };
}
