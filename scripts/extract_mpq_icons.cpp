#include <StormLib.h>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

std::string outputName(std::string icon) {
    for (char& character : icon) {
        if (character == '\\' || character == '/' || character == ':') character = '-';
    }
    return icon;
}

int main(int argc, char* argv[]) {
    if (argc < 4) {
        std::cerr << "Usage: extract_mpq_icons <icon-list> <output-dir> <archive>...\n";
        return 1;
    }

    std::ifstream list(argv[1]);
    std::vector<std::string> icons;
    for (std::string icon; std::getline(list, icon);) {
        if (!icon.empty()) icons.push_back(icon);
    }
    fs::create_directories(argv[2]);

    for (int archiveIndex = argc - 1; archiveIndex >= 3 && !icons.empty(); --archiveIndex) {
        HANDLE archive = nullptr;
        if (!SFileOpenArchive(argv[archiveIndex], 0, STREAM_FLAG_READ_ONLY, &archive)) continue;

        for (size_t index = 0; index < icons.size();) {
            HANDLE file = nullptr;
            if (!SFileOpenFileEx(archive, icons[index].c_str(), SFILE_OPEN_FROM_MPQ, &file)) {
                ++index;
                continue;
            }

            DWORD size = SFileGetFileSize(file, nullptr);
            std::vector<char> content(size);
            DWORD read = 0;
            bool success = SFileReadFile(file, content.data(), size, &read, nullptr) && read == size;
            SFileCloseFile(file);
            if (!success) {
                ++index;
                continue;
            }

            std::ofstream output(fs::path(argv[2]) / outputName(icons[index]), std::ios::binary);
            output.write(content.data(), content.size());
            std::cout << icons[index] << "\n";
            icons.erase(icons.begin() + index);
        }
        SFileCloseArchive(archive);
    }

    std::cerr << "Missing " << icons.size() << " icons\n";
    return 0;
}
