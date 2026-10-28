#!/bin/sh
# Adds Jesutobits' package repository and installs Jesutobits, on Debian, Ubuntu and their
# relatives (apt), Fedora and RHEL relatives (dnf), and openSUSE (zypper). After this,
# Jesutobits updates with the rest of the system.
#
#   curl -fsSL @@PAGES@@/install.sh | sudo sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
	echo "Run it as root: curl -fsSL @@PAGES@@/install.sh | sudo sh" >&2
	exit 1
fi
if [ "$(uname -m)" != x86_64 ]; then
	echo "Jesutobits' Linux packages are for 64-bit Intel and AMD (x86_64) only." >&2
	exit 1
fi

fetch() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1"
	else
		wget -qO- "$1"
	fi
}

if command -v apt-get >/dev/null 2>&1; then
	install -d -m 0755 /usr/share/keyrings /etc/apt/sources.list.d
	fetch @@PAGES@@/jesutobits.gpg > /usr/share/keyrings/jesutobits.gpg
	cat > /etc/apt/sources.list.d/jesutobits.sources <<EOF
Types: deb
URIs: @@APT@@
Suites: /
Signed-By: /usr/share/keyrings/jesutobits.gpg
EOF
	apt-get update
	apt-get install -y jesutobits
elif command -v dnf >/dev/null 2>&1; then
	fetch @@PAGES@@/rpm/jesutobits.repo > /etc/yum.repos.d/jesutobits.repo
	dnf install -y jesutobits
elif command -v zypper >/dev/null 2>&1; then
	zypper --non-interactive addrepo --refresh @@PAGES@@/rpm/jesutobits.repo
	zypper --non-interactive --gpg-auto-import-keys install jesutobits
else
	echo "No apt, dnf or zypper here. Download a package from @@RELEASES@@" >&2
	exit 1
fi

echo "Jesutobits is installed. Start it from your applications, or run: jesutobits"
