// The Pip contract page: the committed pip.riv in the web runtime the app
// ships (@rive-app/react-webgl2 on @rive-app/webgl2), with the WASM served
// from this origin, no fallback URL and no asset CDN. It reads what the loaded
// file says about itself and lets e2e/pip-contract.spec.ts drive the view
// model through `window.pip`. A test page: never part of the app.
import { useRive } from "@rive-app/react-webgl2";
import { RuntimeLoader, type Rive } from "@rive-app/webgl2";
import wasmUrl from "@rive-app/webgl2/rive.wasm?url";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PIP_STATE_MACHINE, type PipDriver, type RigShape } from "../contract";
import rivUrl from "../pip.riv?url";
import "./page.css";

RuntimeLoader.setWasmUrl(wasmUrl);
RuntimeLoader.setWasmFallbackUrl(null);

declare global {
  interface Window {
    pip?: PipDriver;
    pipLoadError?: string;
  }
}

function readShape(rive: Rive): RigShape {
  const viewModels = Array.from({ length: rive.viewModelCount }, (_, i) =>
    rive.viewModelByIndex(i),
  ).flatMap((viewModel) => (viewModel ? [viewModel] : []));
  return {
    artboards: (rive.contents.artboards ?? []).map((artboard) => ({
      name: artboard.name,
      stateMachines: artboard.stateMachines.map((machine) => ({
        name: machine.name,
        inputs: machine.inputs.map((input) => input.name),
      })),
    })),
    defaultViewModel: rive.defaultViewModel()?.name ?? null,
    viewModels: viewModels.map((viewModel) => ({
      name: viewModel.name,
      properties: viewModel.properties.map((property) => ({
        name: property.name,
        type: property.type,
        enumName: property.enumName,
      })),
    })),
    enums: rive.enums().map((dataEnum) => ({
      name: dataEnum.name,
      values: dataEnum.values,
    })),
  };
}

function driver(rive: Rive): PipDriver {
  const instance = () => {
    const bound = rive.viewModelInstance;
    if (!bound) throw new Error("no view model instance is bound");
    return bound;
  };
  const property = <T,>(value: T | null, name: string): T => {
    if (value === null) throw new Error(`the view model has no ${name}`);
    return value;
  };
  return {
    shape: () => readShape(rive),
    setMode: (mode) => {
      property(instance().enum("mode"), "mode").value = mode;
    },
    fire: (reaction) => {
      property(instance().trigger(reaction), reaction).trigger();
    },
    setNumber: (name, value) => {
      property(instance().number(name), name).value = value;
    },
    setReducedMotion: (value) => {
      property(instance().boolean("reducedMotion"), "reducedMotion").value =
        value;
    },
    mode: () => property(instance().enum("mode"), "mode").value,
    playing: () => rive.isPlaying,
  };
}

function ContractPage() {
  const { RiveComponent } = useRive(
    {
      src: rivUrl,
      stateMachine: PIP_STATE_MACHINE,
      autoplay: true,
      autoBind: true,
      enableRiveAssetCDN: false,
      onLoadError: (event) => {
        // The runtime reports a load failure as a message string.
        window.pipLoadError =
          typeof event.data === "string" ? event.data : event.type;
      },
      onRiveReady: (rive) => {
        window.pip = driver(rive);
      },
    },
    { useOffscreenRenderer: true },
  );
  return <RiveComponent className="pip" aria-hidden="true" />;
}

const root = document.getElementById("root");
if (!root) throw new Error("no #root");
createRoot(root).render(
  <StrictMode>
    <ContractPage />
  </StrictMode>,
);
