/**
 * Bangladesh delivery areas: all 8 divisions and all 64 districts, with thanas and upazilas for
 * the districts below. A district that has no list here is still orderable: the checkout asks for
 * the thana or upazila as free text, and the courier address comes from the street address.
 *
 * Coverage is honest, not exhaustive: the lists were typed from the public administrative
 * hierarchy and have not been matched against a courier's area codes (`geo_areas.courier_codes`
 * stays empty until a courier is connected). Add or correct an area in the database; the seed only
 * ever adds rows that are missing and never edits or removes one.
 */

export interface GeoDistrict {
  name: string;
  /** Thanas (city areas) and upazilas. Omitted when the district has no list yet. */
  thanas?: readonly string[];
}

export interface GeoDivision {
  name: string;
  nameBn: string;
  districts: readonly GeoDistrict[];
}

const DHAKA_CITY = [
  'Adabor',
  'Badda',
  'Banani',
  'Bangshal',
  'Bimanbandar',
  'Cantonment',
  'Chawkbazar',
  'Dakshinkhan',
  'Darus Salam',
  'Demra',
  'Dhanmondi',
  'Gendaria',
  'Gulshan',
  'Hazaribagh',
  'Jatrabari',
  'Kadamtali',
  'Kafrul',
  'Kalabagan',
  'Kamrangirchar',
  'Khilgaon',
  'Khilkhet',
  'Kotwali',
  'Lalbagh',
  'Mirpur',
  'Mohammadpur',
  'Motijheel',
  'Mugda',
  'New Market',
  'Pallabi',
  'Paltan',
  'Ramna',
  'Rampura',
  'Sabujbagh',
  'Shah Ali',
  'Shahbagh',
  'Sher-e-Bangla Nagar',
  'Shyampur',
  'Sutrapur',
  'Tejgaon',
  'Turag',
  'Uttara',
  'Uttar Khan',
  'Vatara',
] as const;

const DHAKA_OUTER = ['Dhamrai', 'Dohar', 'Keraniganj', 'Nawabganj', 'Savar'] as const;

export const GEO_DIVISIONS: readonly GeoDivision[] = [
  {
    name: 'Barishal',
    nameBn: 'বরিশাল',
    districts: [
      { name: 'Barguna' },
      {
        name: 'Barishal',
        thanas: [
          'Agailjhara',
          'Babuganj',
          'Bakerganj',
          'Banaripara',
          'Barishal Sadar',
          'Gaurnadi',
          'Hizla',
          'Mehendiganj',
          'Muladi',
          'Wazirpur',
        ],
      },
      { name: 'Bhola' },
      { name: 'Jhalokati' },
      { name: 'Patuakhali' },
      { name: 'Pirojpur' },
    ],
  },
  {
    name: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
    districts: [
      { name: 'Bandarban' },
      {
        name: 'Brahmanbaria',
        thanas: [
          'Akhaura',
          'Ashuganj',
          'Bancharampur',
          'Bijoynagar',
          'Brahmanbaria Sadar',
          'Kasba',
          'Nabinagar',
          'Nasirnagar',
          'Sarail',
        ],
      },
      {
        name: 'Chandpur',
        thanas: [
          'Chandpur Sadar',
          'Faridganj',
          'Haimchar',
          'Haziganj',
          'Kachua',
          'Matlab Dakshin',
          'Matlab Uttar',
          'Shahrasti',
        ],
      },
      {
        name: 'Chattogram',
        thanas: [
          'Akbar Shah',
          'Anwara',
          'Bakalia',
          'Banshkhali',
          'Bayazid Bostami',
          'Boalkhali',
          'Chandanaish',
          'Chandgaon',
          'Chawkbazar',
          'Double Mooring',
          'Fatikchhari',
          'Halishahar',
          'Hathazari',
          'Khulshi',
          'Kotwali',
          'Lohagara',
          'Mirsharai',
          'Pahartali',
          'Panchlaish',
          'Patenga',
          'Patiya',
          'Rangunia',
          'Raozan',
          'Sandwip',
          'Satkania',
          'Sitakunda',
        ],
      },
      {
        name: 'Cumilla',
        thanas: [
          'Barura',
          'Brahmanpara',
          'Burichang',
          'Chandina',
          'Chauddagram',
          'Cumilla Sadar',
          'Cumilla Sadar Dakshin',
          'Daudkandi',
          'Debidwar',
          'Homna',
          'Laksam',
          'Lalmai',
          'Meghna',
          'Monohargonj',
          'Muradnagar',
          'Nangalkot',
          'Titas',
        ],
      },
      {
        name: "Cox's Bazar",
        thanas: [
          'Chakaria',
          "Cox's Bazar Sadar",
          'Kutubdia',
          'Maheshkhali',
          'Pekua',
          'Ramu',
          'Teknaf',
          'Ukhia',
        ],
      },
      {
        name: 'Feni',
        thanas: ['Chhagalnaiya', 'Daganbhuiyan', 'Feni Sadar', 'Fulgazi', 'Parshuram', 'Sonagazi'],
      },
      { name: 'Khagrachhari' },
      {
        name: 'Lakshmipur',
        thanas: ['Kamalnagar', 'Lakshmipur Sadar', 'Raipur', 'Ramganj', 'Ramgati'],
      },
      {
        name: 'Noakhali',
        thanas: [
          'Begumganj',
          'Chatkhil',
          'Companiganj',
          'Hatiya',
          'Kabirhat',
          'Noakhali Sadar',
          'Senbagh',
          'Sonaimuri',
          'Subarnachar',
        ],
      },
      { name: 'Rangamati' },
    ],
  },
  {
    name: 'Dhaka',
    nameBn: 'ঢাকা',
    districts: [
      { name: 'Dhaka', thanas: [...DHAKA_CITY, ...DHAKA_OUTER] },
      {
        name: 'Faridpur',
        thanas: [
          'Alfadanga',
          'Bhanga',
          'Boalmari',
          'Charbhadrasan',
          'Faridpur Sadar',
          'Madhukhali',
          'Nagarkanda',
          'Sadarpur',
          'Saltha',
        ],
      },
      {
        name: 'Gazipur',
        thanas: ['Gazipur Sadar', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur', 'Tongi'],
      },
      { name: 'Gopalganj' },
      {
        name: 'Kishoreganj',
        thanas: [
          'Austagram',
          'Bajitpur',
          'Bhairab',
          'Hossainpur',
          'Itna',
          'Karimganj',
          'Katiadi',
          'Kishoreganj Sadar',
          'Kuliarchar',
          'Mithamain',
          'Nikli',
          'Pakundia',
          'Tarail',
        ],
      },
      { name: 'Madaripur' },
      {
        name: 'Manikganj',
        thanas: [
          'Daulatpur',
          'Ghior',
          'Harirampur',
          'Manikganj Sadar',
          'Saturia',
          'Shivalaya',
          'Singair',
        ],
      },
      {
        name: 'Munshiganj',
        thanas: [
          'Gazaria',
          'Lohajang',
          'Munshiganj Sadar',
          'Sirajdikhan',
          'Sreenagar',
          'Tongibari',
        ],
      },
      {
        name: 'Narayanganj',
        thanas: ['Araihazar', 'Bandar', 'Narayanganj Sadar', 'Rupganj', 'Siddhirganj', 'Sonargaon'],
      },
      {
        name: 'Narsingdi',
        thanas: ['Belabo', 'Monohardi', 'Narsingdi Sadar', 'Palash', 'Raipura', 'Shibpur'],
      },
      { name: 'Rajbari' },
      { name: 'Shariatpur' },
      {
        name: 'Tangail',
        thanas: [
          'Basail',
          'Bhuapur',
          'Delduar',
          'Dhanbari',
          'Ghatail',
          'Gopalpur',
          'Kalihati',
          'Madhupur',
          'Mirzapur',
          'Nagarpur',
          'Sakhipur',
          'Tangail Sadar',
        ],
      },
    ],
  },
  {
    name: 'Khulna',
    nameBn: 'খুলনা',
    districts: [
      { name: 'Bagerhat' },
      { name: 'Chuadanga' },
      {
        name: 'Jashore',
        thanas: [
          'Abhaynagar',
          'Bagherpara',
          'Chaugachha',
          'Jashore Sadar',
          'Jhikargachha',
          'Keshabpur',
          'Manirampur',
          'Sharsha',
        ],
      },
      { name: 'Jhenaidah' },
      {
        name: 'Khulna',
        thanas: [
          'Batiaghata',
          'Dacope',
          'Daulatpur',
          'Dighalia',
          'Dumuria',
          'Khalishpur',
          'Khan Jahan Ali',
          'Khulna Sadar',
          'Koyra',
          'Paikgachha',
          'Phultala',
          'Rupsha',
          'Sonadanga',
          'Terokhada',
        ],
      },
      {
        name: 'Kushtia',
        thanas: ['Bheramara', 'Daulatpur', 'Khoksa', 'Kumarkhali', 'Kushtia Sadar', 'Mirpur'],
      },
      { name: 'Magura' },
      { name: 'Meherpur' },
      { name: 'Narail' },
      { name: 'Satkhira' },
    ],
  },
  {
    name: 'Mymensingh',
    nameBn: 'ময়মনসিংহ',
    districts: [
      { name: 'Jamalpur' },
      {
        name: 'Mymensingh',
        thanas: [
          'Bhaluka',
          'Dhobaura',
          'Fulbaria',
          'Gafargaon',
          'Gouripur',
          'Haluaghat',
          'Ishwarganj',
          'Muktagachha',
          'Mymensingh Sadar',
          'Nandail',
          'Phulpur',
          'Tarakanda',
          'Trishal',
        ],
      },
      { name: 'Netrokona' },
      { name: 'Sherpur' },
    ],
  },
  {
    name: 'Rajshahi',
    nameBn: 'রাজশাহী',
    districts: [
      {
        name: 'Bogura',
        thanas: [
          'Adamdighi',
          'Bogura Sadar',
          'Dhunat',
          'Dhupchanchia',
          'Gabtali',
          'Kahaloo',
          'Nandigram',
          'Sariakandi',
          'Sherpur',
          'Shibganj',
          'Sonatala',
        ],
      },
      { name: 'Chapainawabganj' },
      { name: 'Joypurhat' },
      { name: 'Naogaon' },
      { name: 'Natore' },
      {
        name: 'Pabna',
        thanas: [
          'Atgharia',
          'Bera',
          'Bhangura',
          'Chatmohar',
          'Faridpur',
          'Ishwardi',
          'Pabna Sadar',
          'Santhia',
          'Sujanagar',
        ],
      },
      {
        name: 'Rajshahi',
        thanas: [
          'Bagha',
          'Bagmara',
          'Boalia',
          'Charghat',
          'Durgapur',
          'Godagari',
          'Mohanpur',
          'Motihar',
          'Paba',
          'Puthia',
          'Rajpara',
          'Shah Makhdum',
          'Tanore',
        ],
      },
      {
        name: 'Sirajganj',
        thanas: [
          'Belkuchi',
          'Chauhali',
          'Kamarkhanda',
          'Kazipur',
          'Raiganj',
          'Shahjadpur',
          'Sirajganj Sadar',
          'Tarash',
          'Ullahpara',
        ],
      },
    ],
  },
  {
    name: 'Rangpur',
    nameBn: 'রংপুর',
    districts: [
      {
        name: 'Dinajpur',
        thanas: [
          'Birampur',
          'Birganj',
          'Biral',
          'Bochaganj',
          'Chirirbandar',
          'Dinajpur Sadar',
          'Fulbari',
          'Ghoraghat',
          'Hakimpur',
          'Kaharole',
          'Khansama',
          'Nawabganj',
          'Parbatipur',
        ],
      },
      { name: 'Gaibandha' },
      { name: 'Kurigram' },
      { name: 'Lalmonirhat' },
      { name: 'Nilphamari' },
      { name: 'Panchagarh' },
      {
        name: 'Rangpur',
        thanas: [
          'Badarganj',
          'Gangachara',
          'Kaunia',
          'Mithapukur',
          'Pirgachha',
          'Pirganj',
          'Rangpur Sadar',
          'Taraganj',
        ],
      },
      { name: 'Thakurgaon' },
    ],
  },
  {
    name: 'Sylhet',
    nameBn: 'সিলেট',
    districts: [
      {
        name: 'Habiganj',
        thanas: [
          'Ajmiriganj',
          'Bahubal',
          'Baniachong',
          'Chunarughat',
          'Habiganj Sadar',
          'Lakhai',
          'Madhabpur',
          'Nabiganj',
          'Shayestaganj',
        ],
      },
      {
        name: 'Moulvibazar',
        thanas: [
          'Barlekha',
          'Juri',
          'Kamalganj',
          'Kulaura',
          'Moulvibazar Sadar',
          'Rajnagar',
          'Sreemangal',
        ],
      },
      {
        name: 'Sunamganj',
        thanas: [
          'Bishwamvarpur',
          'Chhatak',
          'Dakshin Sunamganj',
          'Derai',
          'Dharampasha',
          'Dowarabazar',
          'Jagannathpur',
          'Jamalganj',
          'Sullah',
          'Sunamganj Sadar',
          'Tahirpur',
        ],
      },
      {
        name: 'Sylhet',
        thanas: [
          'Balaganj',
          'Beanibazar',
          'Bishwanath',
          'Companiganj',
          'Dakshin Surma',
          'Fenchuganj',
          'Golapganj',
          'Gowainghat',
          'Jaintiapur',
          'Kanaighat',
          'Osmani Nagar',
          'Sylhet Sadar',
          'Zakiganj',
        ],
      },
    ],
  },
];

/** `Cox's Bazar` becomes `coxs-bazar`: the stable part of a geo area code. */
export function geoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface GeoCoverage {
  divisions: number;
  districts: number;
  districtsWithThanas: number;
  thanas: number;
}

export function geoCoverage(divisions: readonly GeoDivision[] = GEO_DIVISIONS): GeoCoverage {
  const districts = divisions.flatMap((d) => d.districts);
  return {
    divisions: divisions.length,
    districts: districts.length,
    districtsWithThanas: districts.filter((d) => (d.thanas?.length ?? 0) > 0).length,
    thanas: districts.reduce((sum, d) => sum + (d.thanas?.length ?? 0), 0),
  };
}
