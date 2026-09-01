# Connecting a Klipper / Moonraker printer to Spooly

Spooly connects to Klipper printers through Moonraker's local HTTP API.

## Recommended setup: Scan

1. Turn on the printer and connect the computer running Spooly to the same local network.
2. Open **Spooly Setup**.
3. Choose **Klipper / Moonraker** as the printer type.
4. Click **Scan local network**.
5. Select the discovered printer and click **Save & connect**.

Spooly checks Bonjour advertisements and private IPv4 networks for Moonraker's `/server/info` endpoint. It does not scan public Internet addresses.

## Manual setup

If discovery is blocked by guest Wi-Fi, VLAN isolation, a VPN, or a firewall, enter:

- A name for the printer.
- The printer's local IP address or hostname.
- The Moonraker port, normally `7125`.

Then click **Save & connect**.

## Snapmaker U1 with Paxx12 firmware

Paxx12 firmware can require a login for Moonraker API access. If Spooly reports `Moonraker returned 401`, open `http://<printer-ip>/firmware-config/` and disable **Require Login** under the web settings, then reconnect Spooly.

The current Spooly release does not yet support authenticated Moonraker connections. Optional Moonraker API-key support is planned for a future update for users who prefer to keep **Require Login** enabled.

## If Spooly cannot connect

1. Confirm the printer's Moonraker web interface is reachable from the same computer.
2. Confirm the host and port are correct.
3. Avoid guest Wi-Fi or client-isolated networks.
4. Temporarily disable a VPN that changes local-network routing.
5. Check Moonraker's `trusted_clients` or authorization configuration if it rejects the computer.
6. Reserve the printer's address in the router if its IP changes frequently.

The Snapmaker U1 has been physically verified. Other Moonraker-compatible machines may work but have not all been tested.
