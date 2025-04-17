/// <reference types="@citizenfx/client" />
/// <reference types="@citizenfx/server" />

// Client-side FiveM declarations
declare function GetResourceState(resourceName: string): string;
declare function GetCurrentResourceName(): string;
declare function GetResourcePath(resourceName: string): string;
declare function AddEventHandler(eventName: string, handler: (...args: any[]) => void): void;
declare function RemoveEventHandler(eventName: string, handler: (...args: any[]) => void): void;
declare function RegisterNetEvent(eventName: string): void;
declare function on(eventName: string, handler: (...args: any[]) => void): void;
declare function onNet(eventName: string, handler: (...args: any[]) => void): void;
declare function emitNet(eventName: string, ...args: any[]): void;

declare function RegisterCommand(commandName: string, handler: (source: number, args: string[], raw: string) => void, restricted: boolean): void;
declare function TriggerEvent(eventName: string, ...args: any[]): void;
declare function TriggerServerEvent(eventName: string, ...args: any[]): void;

declare function GetPlayerName(playerId: number): string;
declare function PlayerId(): number;
declare function GetPlayerServerId(playerId: number): number;
declare function PlayerPedId(): number;

declare function GetEntityCoords(entity: number, alive: boolean): [number, number, number];
declare function GetEntityHeading(entity: number): number;
declare function SetEntityCoords(entity: number, xPos: number, yPos: number, zPos: number, xAxis: boolean, yAxis: boolean, zAxis: boolean, clearArea: boolean): void;
declare function SetEntityHeading(entity: number, heading: number): void;
declare function DeleteEntity(entity: number): void;
declare function SetEntityInvincible(entity: number, toggle: boolean): void;
declare function FreezeEntityPosition(entity: number, toggle: boolean): void;

declare function SetNotificationTextEntry(type: string): void;
declare function AddTextComponentString(text: string): void;
declare function DrawNotification(blink: boolean, showInBrief: boolean): void;

declare function AddBlipForCoord(x: number, y: number, z: number): number;
declare function SetBlipSprite(blip: number, sprite: number): void;
declare function SetBlipDisplay(blip: number, display: number): void;
declare function SetBlipScale(blip: number, scale: number): void;
declare function SetBlipColour(blip: number, color: number): void;
declare function SetBlipAsShortRange(blip: number, toggle: boolean): void;
declare function BeginTextCommandSetBlipName(textLabel: string): void;
declare function EndTextCommandSetBlipName(blip: number): void;

declare function RequestModel(model: number | string): void;
declare function GetHashKey(model: string): number;
declare function HasModelLoaded(model: number): boolean;
declare function CreatePed(pedType: number, model: number, x: number, y: number, z: number, heading: number, isNetwork: boolean, bScriptHostPed: boolean): number;
declare function SetPedRandomComponentVariation(ped: number, p1: number): void;
declare function SetBlockingOfNonTemporaryEvents(ped: number, toggle: boolean): void;
declare function SetPedCanRagdollFromPlayerImpact(ped: number, toggle: boolean): void;

declare function DrawMarker(type: number, posX: number, posY: number, posZ: number, dirX: number, dirY: number, dirZ: number, rotX: number, rotY: number, rotZ: number, scaleX: number, scaleY: number, scaleZ: number, red: number, green: number, blue: number, alpha: number, bobUpAndDown: boolean, faceCamera: boolean, p19: number, rotate: boolean, textureDict: string | null, textureName: string | null, drawOnEnts: boolean): void;

declare function RequestAnimDict(animDict: string): void;
declare function HasAnimDictLoaded(animDict: string): boolean;
declare function TaskPlayAnim(ped: number, animDictionary: string, animationName: string, blendInSpeed: number, blendOutSpeed: number, duration: number, flag: number, playbackRate: number, lockX: boolean, lockY: boolean, lockZ: boolean): void;
declare function ClearPedTasks(ped: number): void;
declare function TaskStartScenarioInPlace(ped: number, scenarioName: string, unkDelay: number, playEnterAnim: boolean): void;

declare function SetDrawOrigin(x: number, y: number, z: number, p3: number): void;
declare function ClearDrawOrigin(): void;
declare function SetTextScale(scale: number, size: number): void;
declare function SetTextFont(fontType: number): void;
declare function SetTextProportional(p0: boolean): void;
declare function SetTextColour(red: number, green: number, blue: number, alpha: number): void;
declare function SetTextEntry(text: string): void;
declare function SetTextCentre(align: boolean): void;
declare function DrawText(x: number, y: number): void;
declare function DrawRect(x: number, y: number, width: number, height: number, r: number, g: number, b: number, a: number): void;

declare function SetPlayerCanDoDriveBy(player: number, toggle: boolean): void;
declare function SetPlayerLockon(player: number, toggle: boolean): void;
declare function SetPlayerLockonRangeOverride(player: number, range: number): void;
declare function GetSelectedPedWeapon(ped: number): number;
declare function IsPedArmed(ped: number, flags: number): boolean;
declare function SetCurrentPedWeapon(ped: number, weaponHash: number, bForceInHand: boolean): void;

declare function setTick(handler: () => void): number;
declare function clearTick(tickId: number): void;

// Server-side declarations
declare namespace global {
    var source: number;
}

// Export definitions for Webpack
declare module '@citizenfx/client';
declare module '@citizenfx/server';
declare module '@overextended/ox_lib'; 