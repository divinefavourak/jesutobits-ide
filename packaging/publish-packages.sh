#!/usr/bin/env bash
# Publishes a release's Linux packages to Jesutobits' package repositories, so that after a
# one-time setup (install.sh) `sudo apt install jesutobits` and `sudo dnf install jesutobits`
# work, and `apt upgrade` / `dnf upgrade` bring new releases.
#
#   APT: a signed flat repository (InRelease, Release, Packages) with the .deb, as assets of the
#        rolling GitHub release `packages` (GitHub Pages cannot serve files over 100 MB).
#   DNF/zypper: the .rpm, signed, in the same release; its signed repodata on GitHub Pages
#        (repodata/ must be a folder), pointing at the release with xml:base.
#   Pages (branch gh-pages): install.sh, the public key, the .repo file and a short page.
#
# Runs on Ubuntu in CI (packages.yml) with apt-utils, createrepo-c, rpm and gnupg, the signing
# key imported, and GH_TOKEN allowed to write releases and the gh-pages branch.
#
#   packaging/publish-packages.sh v0.3.0
set -euo pipefail

TAG=${1:?usage: publish-packages.sh v<version>}
REPO=${GITHUB_REPOSITORY:-divinefavourak/jesutobits-ide}
OWNER=${REPO%%/*}
NAME=${REPO#*/}
PAGES="https://${OWNER}.github.io/${NAME}"
ASSETS="https://github.com/${REPO}/releases/download/packages"
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)

KEY=$(gpg --list-secret-keys --with-colons | awk -F: '/^fpr:/ {print $10; exit}')
[ -n "$KEY" ] || { echo "No signing key imported" >&2; exit 1; }
echo "Signing with $KEY"

# The release's Linux packages.
gh release download "$TAG" --repo "$REPO" --pattern '*.deb' --pattern '*.rpm' --dir "$WORK/in"
DEB=$(ls "$WORK"/in/*.deb)
RPM=$(ls "$WORK"/in/*.rpm)

# Sign the .rpm itself (dnf and zypper check package signatures with gpgcheck=1).
cat > "$HOME/.rpmmacros" <<EOF
%_gpg_name $KEY
%__gpg /usr/bin/gpg
EOF
rpm --addsign "$RPM"

# APT: a flat repository. Paths in Packages are bare file names, so apt asks for
# <URI>/<file> with no "./" (GitHub's download URLs do not resolve dot segments).
APT="$WORK/apt"
mkdir -p "$APT"
cp "$DEB" "$APT/"
(
	cd "$APT"
	apt-ftparchive packages . | sed 's|^Filename: \./|Filename: |' > Packages
	gzip -9kn Packages
	apt-ftparchive \
		-o APT::FTPArchive::Release::Origin=Jesutobits \
		-o APT::FTPArchive::Release::Label=Jesutobits \
		-o APT::FTPArchive::Release::Suite=stable \
		-o APT::FTPArchive::Release::Architectures=amd64 \
		-o "APT::FTPArchive::Release::Description=Jesutobits packages" \
		release . > Release
	gpg --batch --yes --local-user "$KEY" --clearsign --output InRelease Release
	gpg --batch --yes --local-user "$KEY" --armor --detach-sign --output Release.gpg Release
)

# The rolling release that holds the APT repository and both packages.
if ! gh release view packages --repo "$REPO" >/dev/null 2>&1; then
	gh release create packages --repo "$REPO" --prerelease --latest=false \
		--title "Package repository (apt, dnf)" \
		--notes "This release holds Jesutobits' apt and dnf repositories. Install with: curl -fsSL ${PAGES}/install.sh | sudo sh. To download a package yourself, use the latest Jesutobits release instead."
fi
NEW=("$APT"/InRelease "$APT"/Release "$APT"/Release.gpg "$APT"/Packages "$APT"/Packages.gz "$APT"/*.deb "$RPM")
gh release upload packages --repo "$REPO" --clobber "${NEW[@]}"
# Drop packages of earlier versions (the indexes above list only this one).
KEEP=$(for f in "${NEW[@]}"; do basename "$f"; done)
gh release view packages --repo "$REPO" --json assets -q '.assets[].name' | while read -r asset; do
	if ! grep -qxF "$asset" <<< "$KEEP"; then
		gh release delete-asset packages "$asset" --repo "$REPO" --yes
	fi
done

# DNF/zypper: repodata pointing at the release, signed.
RPMREPO="$WORK/rpm"
mkdir -p "$RPMREPO"
cp "$RPM" "$RPMREPO/"
createrepo_c --baseurl "${ASSETS}/" "$RPMREPO"
gpg --batch --yes --local-user "$KEY" --armor --detach-sign --output "$RPMREPO/repodata/repomd.xml.asc" "$RPMREPO/repodata/repomd.xml"

# GitHub Pages: the setup script, keys, the .repo file, the repodata and a short page.
SITE="$WORK/site"
git clone --quiet --depth 1 --branch gh-pages "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git" "$SITE" 2>/dev/null || {
	git init --quiet "$SITE"
	git -C "$SITE" checkout --quiet --orphan gh-pages
	git -C "$SITE" remote add origin "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
}
rm -rf "$SITE/rpm"
mkdir -p "$SITE/rpm"
cp -r "$RPMREPO/repodata" "$SITE/rpm/"
sed "s|@@PAGES@@|${PAGES}|g" "$HERE/jesutobits.repo" > "$SITE/rpm/jesutobits.repo"
sed -e "s|@@PAGES@@|${PAGES}|g" -e "s|@@APT@@|${ASSETS}/|g" -e "s|@@RELEASES@@|https://github.com/${REPO}/releases/latest|g" "$HERE/pages/install.sh" > "$SITE/install.sh"
sed -e "s|@@PAGES@@|${PAGES}|g" -e "s|@@APT@@|${ASSETS}/|g" -e "s|@@RELEASES@@|https://github.com/${REPO}/releases/latest|g" -e "s|@@VERSION@@|${TAG#v}|g" "$HERE/pages/index.html" > "$SITE/index.html"
cp "$HERE/jesutobits.asc" "$SITE/jesutobits.asc"
gpg --dearmor < "$HERE/jesutobits.asc" > "$SITE/jesutobits.gpg"
touch "$SITE/.nojekyll"
git -C "$SITE" add -A
if git -C "$SITE" diff --cached --quiet; then
	echo "Pages unchanged"
else
	git -C "$SITE" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit --quiet -m "Packages for ${TAG}"
	git -C "$SITE" push --quiet origin gh-pages
fi
echo "Published ${TAG}: ${PAGES}/install.sh"
