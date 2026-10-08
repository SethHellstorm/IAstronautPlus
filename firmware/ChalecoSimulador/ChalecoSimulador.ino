// ESP32-WROVER. Simulacion exclusivamente por Serial: no configura GPIO de salida.
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

const char* SERVICE_UUID = "7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a01";
const char* COMMAND_UUID = "7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a02";
const char* STATUS_UUID = "7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a03";
BLECharacteristic* statusCharacteristic;
struct Request { int effect; unsigned long duration; };
QueueHandle_t requests;
volatile bool connected = false;
volatile bool disconnected = false;
unsigned long started = 0, duration = 0;
int activeEffect = -1;
bool lastPulse = false;
const char* names[] = {"interaccion", "mision_completa", "calor_sol", "frio_neptuno", "apagar"};
const unsigned long durations[] = {200, 450, 3000, 3000, 0};

void reply(const String& text) {
  Serial.println("TX: " + text);
  statusCharacteristic->setValue(text.c_str());
  if (connected) statusCharacteristic->notify();
}
void stopEffect() {
  if (activeEffect >= 0) Serial.println("[SIMULACION] Efecto apagado.");
  activeEffect = -1; duration = 0; lastPulse = false;
}
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { connected = true; Serial.println("Navegador conectado."); }
  void onDisconnect(BLEServer*) override { connected = false; disconnected = true; }
};
class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    // Compatible con getValue() String y std::string; protocolo de comandos cerrado.
    auto raw = characteristic->getValue();
    String text(raw.c_str());
    Serial.println("RX: " + text);
    Request request = {-99, 0};
    if (text == "{\"type\":\"ping\"}") request.effect = -2;
    else if (text == "{\"type\":\"allOff\"}") request.effect = 4;
    else if (text == "{\"type\":\"vibration\",\"channel\":\"all\",\"action\":\"on\",\"duration\":200}") {
      request.effect = -3; request.duration = 200;
    } else {
      for (int i = 0; i < 5; i++) {
        String expected = String("{\"type\":\"effect_sim\",\"effect\":\"") + names[i] +
          "\",\"duration\":" + String(durations[i]) + "}";
        if (text == expected) { request.effect = i; request.duration = durations[i]; break; }
      }
    }
    // Apagar descarta efectos aun no iniciados.
    if (request.effect == 4) xQueueReset(requests);
    if (xQueueSend(requests, &request, 0) != pdTRUE) {
      disconnected = true; // Un desborde detiene los efectos, nunca prolonga uno.
    }
  }
};
void setup() {
  Serial.begin(115200);
  requests = xQueueCreate(8, sizeof(Request));
  if (!requests) { Serial.println("No se pudo crear la cola."); return; }
  BLEDevice::init("ChalecoVR-Simulador");
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service = server->createService(SERVICE_UUID);
  auto command = service->createCharacteristic(COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  command->setCallbacks(new CommandCallbacks());
  statusCharacteristic = service->createCharacteristic(STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  statusCharacteristic->addDescriptor(new BLE2902());
  service->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  BLEDevice::getAdvertising()->start();
  Serial.println("Chaleco simulado listo. Efectos limitados; sin salidas fisicas.");
}
void loop() {
  if (!requests) { delay(10); return; }
  if (disconnected) {
    disconnected = false; stopEffect(); xQueueReset(requests);
    Serial.println("Navegador desconectado o cola detenida.");
    if (!connected) BLEDevice::startAdvertising();
  }
  Request request;
  if (xQueueReceive(requests, &request, 0) == pdTRUE && connected) {
    if (request.effect == -99) reply("error:comando o duracion no permitidos");
    else if (request.effect == -2) reply("pong");
    else if (request.effect == 4) {
      stopEffect();
      // allOff y effect_sim apagar tienen confirmaciones distintas.
      reply("allOff:ok");
      reply("effect_sim:apagar,dur=0");
    } else {
      stopEffect(); started = millis(); duration = request.duration;
      activeEffect = request.effect == -3 ? 0 : request.effect;
      Serial.printf("[SIMULACION] %s durante %lu ms.\n", names[activeEffect], duration);
      if (request.effect == -3) reply("vibration:on,ch=all,dur=200");
      else reply(String("effect_sim:") + names[activeEffect] + ",dur=" + String(duration));
    }
  }
  if (activeEffect >= 0) {
    unsigned long elapsed = millis() - started;
    if (elapsed >= duration) stopEffect();
    else if (activeEffect == 1) {
      bool pulse = elapsed < 150 || (elapsed >= 300 && elapsed < 450);
      if (pulse != lastPulse) { Serial.println(pulse ? "[SIMULACION] Pulso ON" : "[SIMULACION] Pulso OFF"); lastPulse = pulse; }
    }
  }
  delay(1);
}
